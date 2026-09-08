import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * 标签表实体（database-design.md §3.7，支撑 5.3.3 分类）
 * 标签归个人所有，与笔记通过 note_tags 多对多关联
 */
@Entity('tags')
@Index('uq_tags_owner_name', ['owner_id', 'name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  /** 前端展示色（如 #1677ff），可为空 */
  @Column({ type: 'varchar', length: 20, nullable: true })
  color: string | null;

  @CreateDateColumn()
  created_at: Date;
}
