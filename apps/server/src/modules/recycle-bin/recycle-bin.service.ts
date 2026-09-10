import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecycleBin } from '../notes/recycle-bin.entity';
import { Note } from '../notes/note.entity';
import { Folder } from '../notes/folder.entity';

/**
 * 回收站服务（论文 5.7.3 回收站与软删除）
 * 设计（D-007 §3.13）：笔记本体不搬家，recycle_bin 只记"谁、何时、何时到期"；
 * 恢复 = 清 deleted_at + 删本行；彻底清除 = 删 notes 行（外键级联清理一切关联）
 */
@Injectable()
export class RecycleBinService {
  constructor(
    @InjectRepository(RecycleBin) private readonly recycleRepo: Repository<RecycleBin>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(Folder) private readonly foldersRepo: Repository<Folder>,
  ) {}

  /** 我的回收站（含剩余天数——视图 v_recycle_bin_items 的等价计算） */
  async list(userId: string) {
    const rows = await this.recycleRepo
      .createQueryBuilder('rb')
      .innerJoin(Note, 'n', 'n.id = rb.note_id')
      .where('rb.original_owner_id = :userId', { userId })
      .select([
        'rb.id AS id',
        'rb.note_id AS note_id',
        'n.title AS title',
        'rb.deleted_at AS deleted_at',
        'rb.expires_at AS expires_at',
      ])
      .orderBy('rb.deleted_at', 'DESC')
      .getRawMany();
    return rows.map((r) => ({
      ...r,
      days_remaining: Math.max(
        0,
        Math.ceil((new Date(r.expires_at).getTime() - Date.now()) / 86400_000),
      ),
    }));
  }

  private async getOwnedRow(userId: string, recycleId: string): Promise<RecycleBin> {
    const row = await this.recycleRepo.findOne({ where: { id: recycleId } });
    if (!row || row.original_owner_id !== userId) throw new NotFoundException('回收站记录不存在');
    return row;
  }

  /** 恢复：清 deleted_at，放回原文件夹（原文件夹已删则保持未归档） */
  async restore(userId: string, recycleId: string): Promise<{ note_id: string }> {
    const row = await this.getOwnedRow(userId, recycleId);
    const note = await this.notesRepo.findOne({ where: { id: row.note_id } });
    if (!note) throw new NotFoundException('笔记不存在');
    note.deleted_at = null;
    if (row.original_folder_id) {
      const folder = await this.foldersRepo.findOne({
        where: { id: row.original_folder_id, owner_id: userId },
        select: ['id'],
      });
      if (folder) note.folder_id = row.original_folder_id;
    }
    await this.notesRepo.save(note);
    await this.recycleRepo.delete(row.id);
    return { note_id: note.id };
  }

  /** 彻底删除：删 notes 行，版本/分享/标签/增量经外键级联清理 */
  async purge(userId: string, recycleId: string): Promise<void> {
    const row = await this.getOwnedRow(userId, recycleId);
    await this.notesRepo.delete(row.note_id);
  }
}
