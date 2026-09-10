import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Y from 'yjs';
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror';
import { docs } from 'y-websocket/bin/utils';
import { Note } from './note.entity';
import { NoteVersion } from './note-version.entity';
import { NotesService } from './notes.service';
import { prosemirrorToPlainText } from './prosemirror.util';
import { pmJsonToYFragment } from '../realtime/yjs-convert';
import { YjsUpdate } from '../realtime/yjs-update.entity';

/**
 * 版本服务（论文 5.7.1 版本历史 / 5.7.2 回滚与恢复）
 *
 * 快照策略（D-007）：手动保存 + 关键事件（回滚前 source=rollback、
 * 编辑会话结束且有变更 source=auto，见 CollaborationPersistence.writeState）
 *
 * 回滚的两种路径（保证与实时协作一致）：
 * - 笔记文档在内存中（有协作会话）：回滚是 CRDT 操作——清空 fragment 后按快照
 *   重建（transact），在线客户端实时看到回滚，增量随持久化入 yjs_updates
 * - 冷文档：直接回写 content 快照并作废旧增量帧，下次 bindState 以快照重新播种
 */
@Injectable()
export class VersionsService {
  constructor(
    @InjectRepository(NoteVersion) private readonly versionsRepo: Repository<NoteVersion>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(YjsUpdate) private readonly updatesRepo: Repository<YjsUpdate>,
    private readonly notesService: NotesService,
  ) {}

  /** 笔记在内存中的协作文档（WSSharedDoc，含 conns 集合） */
  private liveDoc(noteId: string): Y.Doc | undefined {
    return docs.get(noteId);
  }

  /** 当前真实状态：有协作会话以 Yjs 文档为准，否则以 DB 快照为准 */
  private async currentJson(note: Note): Promise<{ title: string; content: Record<string, unknown> }> {
    const doc = this.liveDoc(note.id);
    if (doc) {
      const content = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default'));
      return { title: note.title, content };
    }
    return { title: note.title, content: note.content };
  }

  private async nextVersionNo(noteId: string): Promise<number> {
    const max = await this.versionsRepo
      .createQueryBuilder('v')
      .where('v.note_id = :noteId', { noteId })
      .select('MAX(v.version_no)', 'max')
      .getRawOne();
    return (max?.max ?? 0) + 1;
  }

  async insertVersion(
    noteId: string,
    title: string,
    content: Record<string, unknown>,
    source: 'manual' | 'auto' | 'rollback',
    userId: string,
  ) {
    return this.versionsRepo.save({
      note_id: noteId,
      version_no: await this.nextVersionNo(noteId),
      title,
      content,
      source,
      created_by: userId,
    });
  }

  /** 与最新版本（标题+内容）相同则不重复建版（防回滚/会话结束连环建版） */
  async insertVersionIfChanged(
    noteId: string,
    title: string,
    content: Record<string, unknown>,
    source: 'manual' | 'auto' | 'rollback',
    userId: string,
  ): Promise<boolean> {
    const latest = await this.versionsRepo.findOne({
      where: { note_id: noteId },
      order: { version_no: 'DESC' },
    });
    if (latest && latest.title === title && JSON.stringify(latest.content) === JSON.stringify(content)) {
      return false;
    }
    await this.insertVersion(noteId, title, content, source, userId);
    return true;
  }

  private async assertReadable(
    userId: string,
    noteId: string,
  ): Promise<{ note: Note; level: 'owner' | 'team_admin' | 'team_edit' }> {
    const { note, level } = await this.notesService.getAccessLevel(userId, noteId);
    if (level === 'team_read') throw new NotFoundException('笔记不存在');
    return { note, level: level as 'owner' | 'team_admin' | 'team_edit' };
  }

  /** 手动保存版本（5.7.1） */
  async saveManual(userId: string, noteId: string) {
    const { note } = await this.assertReadable(userId, noteId);
    const { title, content } = await this.currentJson(note);
    const version = await this.insertVersion(noteId, title, content, 'manual', userId);
    return {
      version_no: version.version_no,
      title: version.title,
      source: version.source,
      created_at: version.created_at,
    };
  }

  /** 版本列表（不含正文，读权限即可见） */
  async list(userId: string, noteId: string) {
    await this.assertReadable(userId, noteId);
    return this.versionsRepo.find({
      where: { note_id: noteId },
      select: ['version_no', 'title', 'source', 'created_by', 'created_at'],
      order: { version_no: 'DESC' },
    });
  }

  /** 版本快照详情（预览用） */
  async detail(userId: string, noteId: string, versionNo: number) {
    await this.assertReadable(userId, noteId);
    const version = await this.versionsRepo.findOne({
      where: { note_id: noteId, version_no: versionNo },
    });
    if (!version) throw new NotFoundException('版本不存在');
    return version;
  }

  /** 回滚（5.7.2）：回滚前自动快照当前状态（source=rollback），再恢复目标版本 */
  async rollback(userId: string, noteId: string, versionNo: number) {
    const { note } = await this.assertReadable(userId, noteId);
    const target = await this.versionsRepo.findOne({
      where: { note_id: noteId, version_no: versionNo },
    });
    if (!target) throw new NotFoundException('版本不存在');

    const current = await this.currentJson(note);
    await this.insertVersionIfChanged(noteId, current.title, current.content, 'rollback', userId);

    const doc = this.liveDoc(noteId);
    if (doc) {
      // 热文档：CRDT 操作（在线客户端实时看到回滚）
      const frag = doc.getXmlFragment('default');
      doc.transact(() => {
        frag.delete(0, frag.length);
        pmJsonToYFragment(target.content, frag);
      });
      await this.notesRepo.update(noteId, { title: target.title });
    } else {
      // 冷文档：直接回写快照并作废旧增量帧（下次播种以快照为准）
      await this.notesRepo.update(noteId, {
        title: target.title,
        content: target.content as never,
        content_text: prosemirrorToPlainText(target.content),
      });
      await this.updatesRepo.delete({ note_id: noteId });
    }
    return { rolled_back_to: versionNo, pre_rollback_snapshot: true };
  }
}
