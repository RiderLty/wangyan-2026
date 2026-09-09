import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { Note } from '../notes/note.entity';
import { prosemirrorToPlainText } from '../notes/prosemirror.util';
import { YjsUpdate } from './yjs-update.entity';
import { pmJsonToYFragment } from './yjs-convert';

/**
 * Yjs 持久化适配器（论文 4.4.2 Yjs 文档同步机制 / 5.4.1）
 *
 * 数据分工遵循 D-007：yjs_updates 是事实来源（追加式增量日志），
 * notes.content 是合并后的快照（供列表/搜索/导出/版本）。
 *
 * - bindState（打开文档）：回放库中全部增量；若无增量则从 content 快照播种
 *   （5.3 时代的旧笔记无缝升级为协作文档），并把种子存为第一帧增量
 * - 期间每帧新增量缓冲 2s 合并入库（Y.mergeUpdates，避免逐键写行）
 * - writeState（末个连接断开）：Yjs 文档状态合并回写 content + content_text，
 *   并清理本次会话前已合并的增量行（compaction，控制日志膨胀）
 */
@Injectable()
export class CollaborationPersistence {
  private readonly logger = new Logger(CollaborationPersistence.name);

  /** docName(noteId) → 该文档回放过的最大增量 id（writeState 时据此清理） */
  private readonly replayedMaxId = new Map<string, string | null>();
  /** docName → 待入库的增量缓冲 */
  private readonly pendingUpdates = new Map<string, Uint8Array[]>();
  private readonly flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** bindState 回放期间抑制 update 监听器重复入库（回放触发的 update 事件已在库中） */
  private readonly loadingDocs = new Set<string>();

  constructor(
    @InjectRepository(YjsUpdate) private readonly updatesRepo: Repository<YjsUpdate>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
  ) {}

  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = docName;
    this.loadingDocs.add(noteId);

    const rows = await this.updatesRepo.find({
      where: { note_id: noteId },
      order: { id: 'ASC' },
    });
    this.replayedMaxId.set(noteId, rows.length ? rows[rows.length - 1].id : null);
    this.logger.log(
      `[协作] bindState ${noteId}: 回放 ${rows.length} 帧(${rows.map((r) => r.update.length).join(',')}B)`,
    );

    if (rows.length) {
      // 常规路径：按自增顺序回放增量
      for (const row of rows) Y.applyUpdate(ydoc, new Uint8Array(row.update));
    } else {
      // 首次协作：从 notes.content 快照播种（5.3 旧笔记升级），种子存为第一帧
      const note = await this.notesRepo.findOne({
        where: { id: noteId, deleted_at: IsNull() },
        select: ['id', 'content'],
      });
      if (note) {
        pmJsonToYFragment(note.content, ydoc.getXmlFragment('default'));
        const seed = Y.encodeStateAsUpdate(ydoc);
        this.logger.log(
          `[协作] bindState ${noteId}: 播种 content blocks=${(note.content as { content?: unknown[] })?.content?.length ?? 'N/A'} seed=${seed.length}B`,
        );
        await this.updatesRepo.insert({ note_id: noteId, update: Buffer.from(seed) });
      } else {
        this.logger.warn(`[协作] bindState ${noteId}: 笔记不存在，跳过播种`);
      }
    }

    this.loadingDocs.delete(noteId);

    // 之后的所有增量（本地或远端）都进缓冲，2s 合并入库
    ydoc.on('update', (update: Uint8Array) => {
      if (this.loadingDocs.has(noteId)) return;
      this.bufferUpdate(noteId, update);
    });
  }

  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = docName;
    this.flushBuffer(noteId);

    // Yjs 文档 → ProseMirror JSON 快照（y-prosemirror 官方 schema-free 转换）
    const fragment = ydoc.getXmlFragment('default');
    const json = yXmlFragmentToProsemirrorJSON(fragment);

    // 数据保护（论文 5.4.4 一致性）：空会话不覆盖非空快照。
    // 场景：客户端在同步完成前断开（或异常空连接），其空文档若直接合并
    // 会把正文清空——CRDT 语义上"空"也是一种合法状态，但为防误清，
    // 约定"文档空且库中快照非空"时跳过回写（真正清空笔记属 5.7 回收站范畴）。
    const isEmptyDoc = fragment.length === 0;
    if (isEmptyDoc) {
      const stored = await this.notesRepo.findOne({
        where: { id: noteId },
        select: ['id', 'content'],
      });
      const storedBlocks = (stored?.content as { content?: unknown[] })?.content?.length ?? 0;
      if (storedBlocks > 0) {
        this.logger.warn(
          `[协作] 笔记 ${noteId} 会话文档为空且库中快照非空，跳过回写（防误清保护）`,
        );
        return;
      }
    }

    await this.notesRepo.update(
      { id: noteId },
      { content: json, content_text: prosemirrorToPlainText(json) },
    );

    // compaction：清理回放前已合并的增量行；播种首帧保留（它代表当前快照起点）
    const maxId = this.replayedMaxId.get(noteId) ?? null;
    if (maxId) {
      await this.updatesRepo.delete({ note_id: noteId, id: LessThanOrEqual(maxId) });
    }
    this.replayedMaxId.delete(noteId);
    this.logger.log(`[协作] 笔记 ${noteId} 快照已合并回写，增量压缩完成`);
  }

  /** 连接尚在但服务即将关闭等场景：立即落盘缓冲 */
  async flushAll(): Promise<void> {
    for (const noteId of [...this.pendingUpdates.keys()]) {
      this.flushBuffer(noteId);
    }
  }

  private bufferUpdate(noteId: string, update: Uint8Array): void {
    const buffer = this.pendingUpdates.get(noteId) ?? [];
    buffer.push(update);
    this.pendingUpdates.set(noteId, buffer);
    if (!this.flushTimers.has(noteId)) {
      this.flushTimers.set(
        noteId,
        setTimeout(() => this.flushBuffer(noteId), 2000),
      );
    }
  }

  private flushBuffer(noteId: string): void {
    const timer = this.flushTimers.get(noteId);
    if (timer) clearTimeout(timer);
    this.flushTimers.delete(noteId);

    const buffer = this.pendingUpdates.get(noteId);
    if (!buffer?.length) return;
    this.pendingUpdates.delete(noteId);
    // 多帧合并为一行：CRDT 增量可无序拼接（Y.mergeUpdates 语义）
    const merged = buffer.length === 1 ? buffer[0] : Y.mergeUpdates(buffer);
    void this.updatesRepo
      .insert({ note_id: noteId, update: Buffer.from(merged) })
      .catch((err) => this.logger.error(`[协作] 增量入库失败 ${noteId}: ${err}`));
  }
}
