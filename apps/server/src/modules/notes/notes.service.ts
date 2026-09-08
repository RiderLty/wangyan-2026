import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { Folder } from './folder.entity';
import { Tag } from './tag.entity';
import { NoteTag } from './note-tag.entity';
import { RecycleBin, RECYCLE_BIN_RETENTION_DAYS } from './recycle-bin.entity';
import { prosemirrorToPlainText } from './prosemirror.util';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteQueryDto } from './dto/note-query.dto';

/** Tiptap 空文档的 ProseMirror JSON */
export const EMPTY_DOC = { type: 'doc', content: [] };

/** LIKE/ILIKE 通配符转义，防止用户输入 % _ 影响匹配语义 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** 笔记服务（论文 5.3.1 / 5.3.4，接口组 4.6.2） */
@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(Folder) private readonly foldersRepo: Repository<Folder>,
    @InjectRepository(Tag) private readonly tagsRepo: Repository<Tag>,
    @InjectRepository(NoteTag) private readonly noteTagsRepo: Repository<NoteTag>,
    @InjectRepository(RecycleBin) private readonly recycleRepo: Repository<RecycleBin>,
  ) {}

  /** 校验文件夹归属当前用户（5.3.3）；folderId 为 null/undefined 视为未归档，放行 */
  private async assertFolderOwned(userId: string, folderId?: string | null): Promise<void> {
    if (folderId == null) return;
    const folder = await this.foldersRepo.findOne({
      where: { id: folderId, owner_id: userId },
    });
    if (!folder) throw new NotFoundException('文件夹不存在');
  }

  /** 新建笔记（个人空间：team_id 恒为 NULL，团队笔记在 5.5 引入） */
  async create(userId: string, dto: CreateNoteDto): Promise<Note> {
    await this.assertFolderOwned(userId, dto.folder_id ?? null);
    const content = dto.content ?? EMPTY_DOC;
    const note = this.notesRepo.create({
      owner_id: userId,
      team_id: null,
      folder_id: dto.folder_id ?? null,
      title: dto.title?.trim() || '未命名笔记',
      content,
      // 反规范化 R1：保存时同步维护派生列（论文 4.3 主动交代）
      content_text: prosemirrorToPlainText(content),
      visibility: 'private',
    });
    return this.notesRepo.save(note);
  }

  /**
   * 个人笔记列表 + 搜索（论文 5.3.4）
   * 过滤维度：文件夹 / 未归档 / 标签 / 关键词（标题与 content_text 的 ILIKE 子串匹配）
   */
  async list(userId: string, q: NoteQueryDto) {
    const qb = this.notesRepo
      .createQueryBuilder('n')
      .where('n.owner_id = :userId', { userId })
      .andWhere('n.team_id IS NULL')
      .andWhere('n.deleted_at IS NULL');

    if (q.folder_id === 'root') {
      qb.andWhere('n.folder_id IS NULL');
    } else if (q.folder_id) {
      qb.andWhere('n.folder_id = :folderId', { folderId: q.folder_id });
    }
    if (q.tag_id) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM note_tags nt WHERE nt.note_id = n.id AND nt.tag_id = :tagId)',
        { tagId: q.tag_id },
      );
    }
    if (q.keyword) {
      const kw = `%${escapeLike(q.keyword.trim())}%`;
      qb.andWhere('(n.title ILIKE :kw OR n.content_text ILIKE :kw)', { kw });
    }

    return qb
      .select(['n.id', 'n.title', 'n.folder_id', 'n.updated_at', 'n.created_at'])
      .orderBy('n.updated_at', 'DESC')
      .getMany();
  }

  /** 取一篇"当前用户可操作的个人笔记"；不存在/非本人/已删除/团队笔记一律 404 */
  private async getOwnedNote(userId: string, id: string): Promise<Note> {
    const note = await this.notesRepo.findOne({ where: { id } });
    if (
      !note ||
      note.owner_id !== userId ||
      note.team_id !== null ||
      note.deleted_at !== null
    ) {
      throw new NotFoundException('笔记不存在');
    }
    return note;
  }

  /** 笔记详情（含正文 JSONB） */
  async detail(userId: string, id: string): Promise<Note> {
    return this.getOwnedNote(userId, id);
  }

  /** 更新标题/正文/归属文件夹；content 变更时重算 content_text */
  async update(userId: string, id: string, dto: UpdateNoteDto): Promise<Note> {
    const note = await this.getOwnedNote(userId, id);
    if (dto.title !== undefined) {
      note.title = dto.title.trim() || '未命名笔记';
    }
    if (dto.content !== undefined) {
      note.content = dto.content;
      note.content_text = prosemirrorToPlainText(dto.content);
    }
    if ('folder_id' in dto) {
      await this.assertFolderOwned(userId, dto.folder_id ?? null);
      note.folder_id = dto.folder_id ?? null;
    }
    return this.notesRepo.save(note);
  }

  /**
   * 软删除（论文 5.7.3）：置 deleted_at + 写回收站元数据（设计稿 §3.13，笔记本体不搬家）
   * 查询/恢复/彻底清理接口属 5.7 模块
   */
  async softDelete(userId: string, id: string): Promise<void> {
    const note = await this.getOwnedNote(userId, id);
    note.deleted_at = new Date();
    await this.notesRepo.save(note);
    const expires_at = new Date(note.deleted_at.getTime() + RECYCLE_BIN_RETENTION_DAYS * 86400_000);
    await this.recycleRepo.insert({
      note_id: note.id,
      original_owner_id: note.owner_id,
      original_folder_id: note.folder_id,
      deleted_by: userId,
      deleted_at: note.deleted_at,
      expires_at,
    });
  }

  /** 笔记的标签列表 */
  async listTags(userId: string, noteId: string) {
    await this.getOwnedNote(userId, noteId);
    const rows = await this.noteTagsRepo.find({
      where: { note: { id: noteId } },
      relations: { tag: true },
      order: { tag: { name: 'ASC' } },
    });
    return rows.map((r) => ({ id: r.tag.id, name: r.tag.name, color: r.tag.color }));
  }

  /** 打标签（幂等）：标签必须归属当前用户 */
  async attachTag(userId: string, noteId: string, tagId: string) {
    await this.getOwnedNote(userId, noteId);
    const tag = await this.tagsRepo.findOne({ where: { id: tagId, owner_id: userId } });
    if (!tag) throw new NotFoundException('标签不存在');
    const exists = await this.noteTagsRepo.findOne({
      where: { note_id: noteId, tag_id: tagId },
    });
    if (!exists) {
      await this.noteTagsRepo.insert({ note_id: noteId, tag_id: tagId });
    }
    return this.listTags(userId, noteId);
  }

  /** 摘标签 */
  async detachTag(userId: string, noteId: string, tagId: string) {
    await this.getOwnedNote(userId, noteId);
    await this.noteTagsRepo.delete({ note_id: noteId, tag_id: tagId });
    return this.listTags(userId, noteId);
  }
}
