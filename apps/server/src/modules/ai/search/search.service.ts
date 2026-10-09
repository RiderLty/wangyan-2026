import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotesService } from '../../notes/notes.service';
import { LlmGatewayService } from '../llm/llm-gateway.service';

/**
 * L3 混合检索服务（论文 5.10，v2.0 计划 L3；pgvector + 百炼 qwen3.7-text-embedding）。
 *
 * 架构：
 * - 切片：content_text 按 ~500 字切片（重叠 50 字，≤8 片），嵌入经网关向量通道（1024 维）
 * - 混合检索：关键词 ILIKE 命中 ∪ 向量余弦 topK → RRF（倒数排名融合，k=60）合并排序，
 *   关键词管精确命中、向量管"意思相近"——对比实验见 6.3
 * - RAG 问答：混合检索 top 片段喂 LLM，带 [n] 出处标注（对齐飞书知识问答的产品形态）
 * - 权限：检索范围与 Agent 工具同口径（个人 + 所在团队可读笔记），向量查询同样过滤
 * - 向量直读写走 raw SQL（pgvector 的 vector 类型以字符串 '[a,b,…]' 与参数 ::vector 交互）
 */

export interface HybridHit {
  id: string;
  title: string;
  updated_at: string;
  matched: '关键词' | '语义' | '混合';
  score: number;
  snippet?: string;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const MAX_CHUNKS = 8;
const RRF_K = 60;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly notesService: NotesService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** 正文切片（滑窗，重叠保留跨片语义） */
  private chunkText(text: string): string[] {
    const clean = (text ?? '').trim();
    if (!clean) return [];
    if (clean.length <= CHUNK_SIZE) return [clean];
    const chunks: string[] = [];
    for (let i = 0; i < clean.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      chunks.push(clean.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }

  /** 单篇重索引：切片 → 向量化 → 覆盖写 note_embeddings */
  async reindexNote(userId: string, noteId: string): Promise<{ chunks: number }> {
    const { note } = await this.notesService.getAccessLevel(userId, noteId);
    const chunks = this.chunkText(note.content_text ?? '');
    await this.dataSource.query('DELETE FROM note_embeddings WHERE note_id = $1', [note.id]);
    if (!chunks.length) return { chunks: 0 };
    const vectors = await this.gateway.embed(chunks);
    for (let i = 0; i < chunks.length; i++) {
      await this.dataSource.query(
        'INSERT INTO note_embeddings (note_id, chunk_index, content, embedding) VALUES ($1, $2, $3, $4::vector)',
        [note.id, i, chunks[i], `[${vectors[i].join(',')}]`],
      );
    }
    this.logger.log(`reindex note=${note.id} chunks=${chunks.length}`);
    return { chunks: chunks.length };
  }

  /** 全量重索引（当前用户可见范围内有正文、无向量或内容过期的笔记，≤20 篇/轮） */
  async reindexAll(userId: string): Promise<{ reindexed: number; failed: number }> {
    const ids = await this.visibleNoteIds(userId);
    let reindexed = 0;
    let failed = 0;
    for (const id of ids.slice(0, 20)) {
      try {
        await this.reindexNote(userId, id);
        reindexed++;
      } catch (err) {
        failed++;
        this.logger.warn(`reindexAll note=${id} 失败: ${(err as Error).message}`);
      }
    }
    return { reindexed, failed };
  }

  /** 混合检索：关键词 + 语义 → RRF 融合（论文 5.10 检索架构核心） */
  async hybridSearch(userId: string, query: string, topK = 8): Promise<HybridHit[]> {
    const kw = query.trim();
    if (!kw) return [];

    // ---- 通道一：关键词 ILIKE（个人 + 团队可见，与 Agent search_notes 同口径）----
    const keywordRows = (await this.dataSource.query(
      `SELECT n.id, n.title, n.updated_at,
              substring(n.content_text from greatest(1, position($1 in n.content_text) - 40) for 120) AS snippet
         FROM notes n
        WHERE n.deleted_at IS NULL
          AND (n.title ILIKE $2 OR n.content_text ILIKE $2)
          AND (n.owner_id = $3 OR (n.team_id IN (SELECT team_id FROM team_members WHERE user_id = $3)
                                   AND n.visibility IN ('team_read','team_edit')))
        ORDER BY n.updated_at DESC
        LIMIT 10`,
      [kw, `%${kw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`, userId],
    )) as Array<{ id: string; title: string; updated_at: Date; snippet: string }>;

    // ---- 通道二：向量语义（cosine topK，带可见性过滤）----
    let vectorRows: Array<{ note_id: string; content: string; score: number }> = [];
    if (this.gateway.isEmbeddingsConfigured()) {
      const [vec] = await this.gateway.embed([kw]);
      vectorRows = await this.dataSource.query(
        `SELECT e.note_id, e.content, 1 - (e.embedding <=> $1::vector) AS score
           FROM note_embeddings e
           JOIN notes n ON n.id = e.note_id AND n.deleted_at IS NULL
          WHERE (n.owner_id = $2 OR (n.team_id IN (SELECT team_id FROM team_members WHERE user_id = $2)
                                   AND n.visibility IN ('team_read','team_edit')))
          ORDER BY e.embedding <=> $1::vector
          LIMIT 10`,
        [`[${vec.join(',')}]`, userId],
      );
    }

    // ---- RRF 融合（倒数排名融合，k=60）----
    const byId = new Map<string, HybridHit>();
    const bump = (id: string, rank: number, base: Partial<HybridHit>) => {
      const hit = byId.get(id) ?? {
        id,
        title: base.title ?? '',
        updated_at: base.updated_at ?? new Date().toISOString(),
        matched: base.matched ?? '关键词',
        score: 0,
      };
      hit.score += 1 / (RRF_K + rank);
      hit.matched = byId.has(id) ? '混合' : (base.matched ?? '关键词');
      if (base.snippet) hit.snippet = base.snippet;
      byId.set(id, hit);
    };
    keywordRows.forEach((r: { id: string; title: string; updated_at: Date; snippet: string }, i) =>
      bump(r.id, i + 1, { title: r.title, updated_at: r.updated_at.toISOString(), matched: '关键词', snippet: (r.snippet ?? '').trim() }),
    );
    // 向量命中需补标题（行内未带）
    const vecNoteIds = [...new Set(vectorRows.map((r) => r.note_id))];
    const titles = vecNoteIds.length
      ? ((await this.dataSource.query(
          'SELECT id, title, updated_at FROM notes WHERE id = ANY($1)',
          [vecNoteIds],
        )) as Array<{ id: string; title: string; updated_at: Date }>)
      : [];
    const titleMap = new Map(titles.map((t: { id: string; title: string; updated_at: Date }) => [t.id, t]));
    const bestChunk = new Map<string, string>();
    for (const r of vectorRows) {
      if (!bestChunk.has(r.note_id) && r.score) bestChunk.set(r.note_id, r.content);
    }
    vectorRows.forEach((r, i) => {
      const t = titleMap.get(r.note_id);
      bump(r.note_id, i + 1, {
        title: t?.title ?? '',
        updated_at: t?.updated_at.toISOString() ?? new Date().toISOString(),
        matched: '语义',
        snippet: (bestChunk.get(r.note_id) ?? '').slice(0, 120),
      });
    });

    return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /** RAG 问答：混合检索 top 片段 → 带出处标注的回答（对齐 1.2 节飞书知识问答形态） */
  async ask(userId: string, question: string): Promise<{ answer: string; sources: { id: string; title: string; snippet: string }[] }> {
    const hits = await this.hybridSearch(userId, question, 5);
    if (!hits.length) {
      return { answer: '在你的笔记里没有找到与该问题相关的内容。', sources: [] };
    }
    // 取命中笔记的切片原文做上下文（有 snippet 用 snippet，否则取正文头）
    const contexts: string[] = [];
    const sources: { id: string; title: string; snippet: string }[] = [];
    for (const [i, hit] of hits.entries()) {
      let snippet = hit.snippet ?? '';
      if (!snippet) {
        const rows = await this.dataSource.query(
          'SELECT content FROM note_embeddings WHERE note_id = $1 ORDER BY chunk_index LIMIT 1',
          [hit.id],
        );
        snippet = rows[0]?.content ?? '';
      }
      if (!snippet) continue;
      contexts.push(`[${i + 1}] 《${hit.title}》：${snippet.slice(0, 400)}`);
      sources.push({ id: hit.id, title: hit.title, snippet: snippet.slice(0, 120) });
    }
    if (!contexts.length) {
      return { answer: '命中的笔记暂无可引用的正文内容。', sources: [] };
    }
    const { text } = await this.gateway.chat(
      [
        {
          role: 'system',
          content:
            '你是笔记知识问答助手。只依据给定的笔记片段回答问题；回答用简体中文，在依据处用 [n] 标注出处编号；片段不足以回答时如实说明，不要编造。',
        },
        { role: 'user', content: `笔记片段：\n${contexts.join('\n\n')}\n\n问题：${question}` },
      ],
      { model: this.gateway.activeModel(true), temperature: 0.3, maxTokens: 4096 },
    );
    return { answer: text, sources };
  }

  /** 可见范围内有正文且尚未建立向量的笔记 id（供全量索引/增量补齐） */
  private async visibleNoteIds(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT n.id FROM notes n
        WHERE n.deleted_at IS NULL AND n.content_text <> ''
          AND (n.owner_id = $1 OR (n.team_id IN (SELECT team_id FROM team_members WHERE user_id = $1)
                                   AND n.visibility IN ('team_read','team_edit')))
          AND NOT EXISTS (SELECT 1 FROM note_embeddings e WHERE e.note_id = n.id)
        ORDER BY n.updated_at DESC`,
      [userId],
    );
    return rows.map((r: { id: string }) => r.id);
  }
}
