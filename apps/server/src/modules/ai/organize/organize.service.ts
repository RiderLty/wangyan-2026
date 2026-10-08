import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, In, Repository } from 'typeorm';
import { NotesService } from '../../notes/notes.service';
import { TagsService } from '../../notes/tags.service';
import { Note } from '../../notes/note.entity';
import { NoteAiMeta } from './note-ai-meta.entity';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import { LlmError } from '../llm/llm.types';

/**
 * L2 智能整理服务（论文 5.10，v2.0 计划 L2）：摘要卡 + 标签建议 + 存量批量整理。
 *
 * 触发方式为显式调用（单篇 / 批量后台任务），而非"保存后自动"——
 * 避免与 v1 笔记写路径（writeState 合并回写）耦合，且演示节奏可控（D-019）。
 * 批量整理用进程内顺序队列（不加 Bull 依赖，论文规模足够）。
 */

interface BatchStatus {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  startedAt: string;
}

const ORGANIZE_PROMPT = [
  '你是笔记整理助手。阅读用户笔记的正文，输出 JSON（不要输出 JSON 之外的任何文字）：',
  '{"summary": "<不超过 120 字的摘要，简体中文>", "tags": ["<2~5 个标签，每个 2~8 字，概括主题>"]}',
].join('\n');

@Injectable()
export class OrganizeService {
  private readonly logger = new Logger(OrganizeService.name);
  /** 进程内批量任务进度（按用户隔离；单实例部署，论文规模足够） */
  private batchStatus = new Map<string, BatchStatus>();

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly notesService: NotesService,
    private readonly tagsService: TagsService,
    @InjectRepository(Note) private readonly noteRepo: Repository<Note>,
    @InjectRepository(NoteAiMeta) private readonly metaRepo: Repository<NoteAiMeta>,
  ) {}

  async getMeta(noteId: string): Promise<NoteAiMeta | null> {
    return this.metaRepo.findOne({ where: { note_id: noteId } });
  }

  /** 单篇整理：LLM 生成摘要 + 标签建议，写入 note_ai_meta */
  async organize(userId: string, noteId: string): Promise<NoteAiMeta> {
    const { note } = await this.notesService.getAccessLevel(userId, noteId);
    const body = (note.content_text ?? '').trim();
    if (!body) throw new NotFoundException('笔记正文为空，无法整理');

    const { text } = await this.gateway.chat(
      [
        { role: 'system', content: ORGANIZE_PROMPT },
        { role: 'user', content: `《${note.title}》\n\n${body.slice(0, 6000)}` },
      ],
      { model: this.gateway.activeModel(true), temperature: 0.3, maxTokens: 4096 },
    );
    const parsed = this.parseOrganizeJson(text);
    const meta = this.metaRepo.create({
      note_id: note.id,
      summary: parsed.summary,
      suggested_tags: parsed.tags,
      model: this.gateway.activeModel(true),
    });
    const saved = await this.metaRepo.save(meta);
    this.logger.log(`organize note=${note.id} tags=${parsed.tags.join('/')}`);
    return saved;
  }

  /** 标签采纳：建议标签转正——已有同名标签复用，否则创建，再挂到笔记（幂等） */
  async applyTags(userId: string, noteId: string, names: string[]): Promise<string[]> {
    const attached: string[] = [];
    for (const raw of names.slice(0, 8)) {
      const name = raw.trim().slice(0, 20);
      if (!name) continue;
      const existing = await this.tagsService.list(userId);
      const hit = existing.find((t) => t.name === name);
      const tag = hit ? { id: hit.id } : await this.tagsService.create(userId, { name });
      await this.notesService.attachTag(userId, noteId, tag.id);
      attached.push(name);
    }
    return attached;
  }

  /** 批量整理：后台顺序处理当前用户缺 AI 元数据的个人笔记（≤20 篇/轮） */
  async startBatch(userId: string): Promise<BatchStatus> {
    const current = this.batchStatus.get(userId);
    if (current?.running) return current;
    const pending = await this.noteRepo
      .createQueryBuilder('n')
      .leftJoin(NoteAiMeta, 'm', 'm.note_id = n.id')
      .where('n.owner_id = :userId', { userId })
      .andWhere('n.deleted_at IS NULL')
      .andWhere('m.note_id IS NULL')
      .andWhere("n.content_text <> ''")
      .select(['n.id'])
      .limit(20)
      .getMany();
    const status: BatchStatus = {
      running: true,
      total: pending.length,
      done: 0,
      failed: 0,
      startedAt: new Date().toISOString(),
    };
    this.batchStatus.set(userId, status);
    if (pending.length === 0) {
      status.running = false;
      return status;
    }
    // 后台顺序执行（fire-and-forget；进度经 status 轮询）
    void (async () => {
      for (const n of pending) {
        try {
          await this.organize(userId, n.id);
          status.done++;
        } catch (err) {
          status.failed++;
          this.logger.warn(`batch organize note=${n.id} 失败: ${(err as Error).message}`);
        }
      }
      status.running = false;
    })();
    return status;
  }

  getBatchStatus(userId: string): BatchStatus | null {
    return this.batchStatus.get(userId) ?? null;
  }

  /** 解析 LLM 输出中的 JSON（容错：剥离代码围栏/前后杂文） */
  private parseOrganizeJson(text: string): { summary: string; tags: string[] } {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new LlmError('AI 未返回结构化结果，请重试');
    const raw = JSON.parse(match[0]) as { summary?: unknown; tags?: unknown };
    const summary = typeof raw.summary === 'string' ? raw.summary.slice(0, 300) : '';
    const tags = Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === 'string').slice(0, 5)
      : [];
    if (!summary && !tags.length) throw new LlmError('AI 返回内容为空，请重试');
    return { summary, tags };
  }
}
