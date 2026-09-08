import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from './note.entity';
import { User } from '../users/user.entity';

/**
 * 回收站表实体（database-design.md §3.13 / 论文 4.3.8）
 *
 * 设计说明：笔记本体不搬家（notes.deleted_at 软删），本表只记
 * "谁、何时、何时到期"——恢复 = 清 deleted_at + 删本行；
 * 彻底清除 = 定时任务删 notes 行 + 本行（5.7 模块提供接口与清理任务）。
 * original_* 为删除时刻快照（受控反规范化 R2）。
 *
 * 5.3 阶段：删除笔记时写入本表；查询/恢复/清理接口属 5.7。
 */
@Entity('recycle_bin')
@Index('idx_recycle_expires', ['expires_at'])
export class RecycleBin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  note_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note | null;

  @Column({ type: 'uuid' })
  original_owner_id: string;

  /** 恢复时放回原文件夹 */
  @Column({ type: 'uuid', nullable: true })
  original_folder_id: string | null;

  @Column({ type: 'uuid' })
  deleted_by: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  deleted_at: Date;

  /** = deleted_at + 30 天，5.7.4 定时清理的扫描依据 */
  @Column({ type: 'timestamptz' })
  @Index()
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

/** 回收站保留天数（论文 5.7.3/5.7.4） */
export const RECYCLE_BIN_RETENTION_DAYS = 30;
