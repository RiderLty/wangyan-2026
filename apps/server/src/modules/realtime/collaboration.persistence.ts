import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { Note } from '../notes/note.entity';
import { NoteVersion } from '../notes/note-version.entity';
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
 *   （5.3 时代的旧笔记无缝升级为协作文档），并把种子存为第一帧增量；
 *   回放后文档为空而快照非空时视为增量不完备，以快照为准重新播种（自愈）
 * - 期间每帧新增量缓冲 2s 合并入库（Y.mergeUpdates，避免逐键写行）
 * - writeState（末个连接断开）：Yjs 文档状态合并回写 content + content_text，
 *   并清空全部增量帧（compaction）——快照已包含完整状态，下一会话从快照
 *   重新播种自包含种子帧，保证回放永远完备（增量帧脱离其基础状态无法独立解析）
 */
@Injectable()
export class CollaborationPersistence {
  private readonly logger = new Logger(CollaborationPersistence.name);
  /** docName → 待入库的增量缓冲 */
  private readonly pendingUpdates = new Map<string, Uint8Array[]>();
  private readonly flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** bindState 回放期间抑制 update 监听器重复入库（回放触发的 update 事件已在库中） */
  private readonly loadingDocs = new Set<string>();
  /**
   * 按笔记的异步互斥锁（论文 5.4.4 一致性）：y-websocket 不 await bindState，
   * "连接即断开 → writeState 销毁文档 → 新连接重新播种"的竞态会让同一快照
   * 被播种两次（CRDT 中成为两份内容）。bindState/writeState 串行化消除该窗口。
   */
  private readonly locks = new Map<string, Promise<unknown>>();

  private async withLock<T>(noteId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(noteId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    this.locks.set(noteId, next);
    try {
      return await next;
    } finally {
      if (this.locks.get(noteId) === next) this.locks.delete(noteId);
    }
  }

  constructor(
    @InjectRepository(YjsUpdate) private readonly updatesRepo: Repository<YjsUpdate>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(NoteVersion) private readonly versionsRepo: Repository<NoteVersion>,
  ) {}

  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = docName;
    // y-websocket 不 await 本方法：文档在播种期间被销毁（连接即断）时按已完成处理
    try {
      await this.withLock(noteId, () => this.doBindState(noteId, ydoc));
    } catch (err) {
      this.logger.warn(`[协作] bindState ${noteId} 中止（文档可能已销毁）: ${err}`);
    }
  }

  private async doBindState(noteId: string, ydoc: Y.Doc): Promise<void> {
    this.loadingDocs.add(noteId);

    const rows = await this.updatesRepo.find({
      where: { note_id: noteId },
      order: { id: 'ASC' },
    });
    this.logger.log(
      `[协作] bindState ${noteId}: 回放 ${rows.length} 帧(${rows.map((r) => r.update.length).join(',')}B)`,
    );

    if (rows.length) {
      // 常规路径：按自增顺序回放增量
      for (const row of rows) Y.applyUpdate(ydoc, new Uint8Array(row.update));

      // 回放完备性兜底：若残留增量帧缺失其基础状态（如历史 compaction 后的孤儿帧），
      // 回放得到空文档且快照非空——以快照为准重新播种，并重建自包含帧（自愈）
      const fragment = ydoc.getXmlFragment('default');
      if (fragment.length === 0) {
        const note = await this.notesRepo.findOne({
          where: { id: noteId, deleted_at: IsNull() },
          select: ['id', 'content'],
        });
        const storedBlocks = (note?.content as { content?: unknown[] })?.content?.length ?? 0;
        if (note && storedBlocks > 0) {
          this.logger.warn(
            `[协作] bindState ${noteId}: 增量回放得到空文档而快照非空，改由快照重新播种`,
          );
          pmJsonToYFragment(note.content, fragment);
          const seed = Y.encodeStateAsUpdate(ydoc);
          await this.updatesRepo.delete({ note_id: noteId });
          await this.updatesRepo.insert({ note_id: noteId, update: Buffer.from(seed) });
        }
      }
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
    // 与 bindState 串行（防竞态见 locks 注释）；结束后再清理
    await this.withLock(noteId, () => this.doWriteState(noteId, ydoc));
  }

  private async doWriteState(noteId: string, ydoc: Y.Doc): Promise<void> {
    await this.flushBuffer(noteId);

    // Yjs 文档 → ProseMirror JSON 快照（y-prosemirror 官方 schema-free 转换）
    const fragment = ydoc.getXmlFragment('default');
    const json = yXmlFragmentToProsemirrorJSON(fragment);

    const stored = await this.notesRepo.findOne({
      where: { id: noteId },
      select: ['id', 'owner_id', 'title', 'content', 'content_text'],
    });

    // 数据保护（论文 5.4.4 一致性）：空会话不覆盖非空快照。
    // 场景：客户端在同步完成前断开（或异常空连接），其空文档若直接合并
    // 会把正文清空——CRDT 语义上"空"也是一种合法状态，但为防误清，
    // 约定"文档空且库中快照非空"时跳过回写（真正清空笔记属 5.7 回收站范畴）。
    // 此时同样清空增量帧：快照是事实基准，下一会话从快照重新播种。
    const isEmptyDoc = fragment.length === 0;
    if (isEmptyDoc) {
      const storedBlocks = (stored?.content as { content?: unknown[] })?.content?.length ?? 0;
      if (storedBlocks > 0) {
        this.logger.warn(
          `[协作] 笔记 ${noteId} 会话文档为空且库中快照非空，跳过回写（防误清保护）`,
        );
        await this.updatesRepo.delete({ note_id: noteId });
        return;
      }
    }

    const newText = prosemirrorToPlainText(json);
    if (!stored) return;

    // 关键事件自动快照（D-007 快照策略④ / 论文 5.7.1）：编辑会话结束且有变更时
    // 保存版本（source=auto），与最新版本（标题+内容）相同则跳过
    if (stored.content_text !== newText) {
      const latest = await this.versionsRepo.findOne({
        where: { note_id: noteId },
        order: { version_no: 'DESC' },
      });
      const sameAsLatest =
        latest &&
        latest.title === stored.title &&
        JSON.stringify(latest.content) === JSON.stringify(json);
      if (!sameAsLatest) {
        const maxRow = await this.versionsRepo
          .createQueryBuilder('v')
          .where('v.note_id = :noteId', { noteId })
          .select('MAX(v.version_no)', 'max')
          .getRawOne();
        await this.versionsRepo.insert({
          note_id: noteId,
          version_no: (maxRow?.max ?? 0) + 1,
          title: stored.title,
          content: json,
          source: 'auto',
          created_by: stored.owner_id,
        });
        this.logger.log(`[协作] 笔记 ${noteId} 会话结束有变更，已建自动版本`);
      }
    }

    await this.notesRepo.update({ id: noteId }, { content: json, content_text: newText });

    // compaction：清空全部增量帧。快照已包含完整状态，任何残留帧都会脱离其
    // 基础状态而无法独立解析（回放得到空文档）；下一会话 bindState 无帧时
    // 从快照播种自包含种子帧，保证回放永远完备。
    await this.updatesRepo.delete({ note_id: noteId });
    this.logger.log(`[协作] 笔记 ${noteId} 快照已合并回写，增量帧已压缩`);
  }

  /** 连接尚在但服务即将关闭等场景：立即落盘缓冲 */
  async flushAll(): Promise<void> {
    for (const noteId of [...this.pendingUpdates.keys()]) {
      await this.flushBuffer(noteId);
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

  private flushBuffer(noteId: string): Promise<void> {
    const timer = this.flushTimers.get(noteId);
    if (timer) clearTimeout(timer);
    this.flushTimers.delete(noteId);

    const buffer = this.pendingUpdates.get(noteId);
    if (!buffer?.length) return Promise.resolve();
    this.pendingUpdates.delete(noteId);
    // 多帧合并为一行：CRDT 增量可无序拼接（Y.mergeUpdates 语义）
    const merged = buffer.length === 1 ? buffer[0] : Y.mergeUpdates(buffer);
    // 返回 Promise：writeState 需等待入库完成后再做 compaction，避免删除与插入竞态
    return this.updatesRepo
      .insert({ note_id: noteId, update: Buffer.from(merged) })
      .then(() => undefined)
      .catch((err) => this.logger.error(`[协作] 增量入库失败 ${noteId}: ${err}`));
  }
}
