import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { NoteTag } from './note-tag.entity';
import { Note } from './note.entity';
import { CreateTagDto } from './dto/create-tag.dto';

/** 标签服务（论文 5.3.3 双维度分类：文件夹管层级、标签管横切主题） */
@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag) private readonly tagsRepo: Repository<Tag>,
    @InjectRepository(NoteTag) private readonly noteTagsRepo: Repository<NoteTag>,
  ) {}

  async create(userId: string, dto: CreateTagDto): Promise<Tag> {
    try {
      return await this.tagsRepo.save({
        owner_id: userId,
        name: dto.name.trim(),
        color: dto.color ?? null,
      });
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { driverError?: { code?: string } }).driverError?.code === '23505'
      ) {
        throw new BadRequestException('已存在同名标签');
      }
      throw err;
    }
  }

  /** 标签列表（含使用中的笔记数，只统计未删除笔记） */
  async list(userId: string) {
    return this.tagsRepo
      .createQueryBuilder('t')
      .leftJoin(NoteTag, 'nt', 'nt.tag_id = t.id')
      .leftJoin(Note, 'n', 'n.id = nt.note_id AND n.deleted_at IS NULL')
      .where('t.owner_id = :userId', { userId })
      .select(['t.id AS id', 't.name AS name', 't.color AS color'])
      .addSelect('COUNT(n.id)', 'note_count')
      .groupBy('t.id')
      .orderBy('t.name', 'ASC')
      .getRawMany();
  }

  /** 删除标签；note_tags 经外键级联自动清理 */
  async remove(userId: string, id: string): Promise<void> {
    const tag = await this.tagsRepo.findOne({ where: { id, owner_id: userId } });
    if (!tag) throw new NotFoundException('标签不存在');
    await this.tagsRepo.delete(id);
  }
}
