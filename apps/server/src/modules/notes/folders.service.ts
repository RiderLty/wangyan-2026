import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { Folder } from './folder.entity';
import { Note } from './note.entity';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder.dto';

/** 文件夹服务（论文 5.3.3 分类与文件夹管理） */
@Injectable()
export class FoldersService {
  constructor(
    @InjectRepository(Folder) private readonly foldersRepo: Repository<Folder>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
  ) {}

  private isDuplicateName(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as { driverError?: { code?: string } }).driverError?.code === '23505'
    );
  }

  /**
   * 同级同名查重。数据库唯一索引 (owner_id, parent_id, name) 对根级 NULL 不去重，
   * 故统一在服务层先行校验（设计稿 §3.2 实现调整）
   */
  private async assertNameAvailable(
    userId: string,
    name: string,
    parentId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.foldersRepo
      .createQueryBuilder('f')
      .where('f.owner_id = :userId', { userId })
      .andWhere('f.name = :name', { name })
      .andWhere(
        parentId === null ? 'f.parent_id IS NULL' : 'f.parent_id = :parentId',
        parentId === null ? {} : { parentId },
      );
    if (excludeId) qb.andWhere('f.id != :excludeId', { excludeId });
    if (await qb.getCount()) {
      throw new BadRequestException('同级目录下已存在同名文件夹');
    }
  }

  /** 校验父文件夹归属当前用户；null 表示移到根级 */
  private async assertParentValid(userId: string, parentId: string | null): Promise<void> {
    if (parentId == null) return;
    const parent = await this.foldersRepo.findOne({
      where: { id: parentId, owner_id: userId },
    });
    if (!parent) throw new NotFoundException('目标父文件夹不存在');
  }

  async create(userId: string, dto: CreateFolderDto): Promise<Folder> {
    await this.assertParentValid(userId, dto.parent_id ?? null);
    await this.assertNameAvailable(userId, dto.name.trim(), dto.parent_id ?? null);
    try {
      return await this.foldersRepo.save({
        owner_id: userId,
        parent_id: dto.parent_id ?? null,
        name: dto.name.trim(),
      });
    } catch (err) {
      if (this.isDuplicateName(err)) {
        throw new BadRequestException('同级目录下已存在同名文件夹');
      }
      throw err;
    }
  }

  /** 平铺返回，前端组装树（文件夹数量小，无需嵌套查询） */
  async list(userId: string): Promise<Folder[]> {
    return this.foldersRepo.find({
      where: { owner_id: userId },
      select: ['id', 'parent_id', 'name', 'created_at', 'updated_at'],
      order: { name: 'ASC' },
    });
  }

  /** 重命名 / 移动；移动到自己的子孙目录会成环，沿 parent 链向上校验 */
  async update(userId: string, id: string, dto: UpdateFolderDto): Promise<Folder> {
    const folder = await this.foldersRepo.findOne({ where: { id, owner_id: userId } });
    if (!folder) throw new NotFoundException('文件夹不存在');

    if ('parent_id' in dto) {
      await this.assertParentValid(userId, dto.parent_id ?? null);
      let cursor = dto.parent_id ?? null;
      while (cursor) {
        if (cursor === id) {
          throw new BadRequestException('不能把文件夹移动到它自己或它的子目录下');
        }
        const p = await this.foldersRepo.findOne({
          where: { id: cursor },
          select: ['id', 'parent_id'],
        });
        cursor = p?.parent_id ?? null;
      }
      folder.parent_id = dto.parent_id ?? null;
    }
    if (dto.name !== undefined) {
      folder.name = dto.name.trim();
    }

    // 改名 / 移动后统一查重（target 同级不能有同名文件夹）
    await this.assertNameAvailable(userId, folder.name, folder.parent_id, folder.id);

    try {
      return await this.foldersRepo.save(folder);
    } catch (err) {
      if (this.isDuplicateName(err)) {
        throw new BadRequestException('同级目录下已存在同名文件夹');
      }
      throw err;
    }
  }

  /** 仅允许删除空文件夹（无子文件夹、无未删除笔记），防误删；其余场景先手动清理 */
  async remove(userId: string, id: string): Promise<void> {
    const folder = await this.foldersRepo.findOne({ where: { id, owner_id: userId } });
    if (!folder) throw new NotFoundException('文件夹不存在');

    const childCount = await this.foldersRepo.count({ where: { parent_id: id } });
    if (childCount > 0) throw new BadRequestException('文件夹内还有子文件夹，请先删除');

    const noteCount = await this.notesRepo.count({
      where: { folder_id: id, deleted_at: IsNull() },
    });
    if (noteCount > 0) throw new BadRequestException('文件夹内还有笔记，请先删除或移动');

    await this.foldersRepo.delete(id);
  }
}
