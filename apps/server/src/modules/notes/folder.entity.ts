import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * 文件夹表实体（database-design.md §3.2 / 论文 4.3.5 顺带表述，支撑 5.3.3）
 * 文件夹只属于个人空间；parent_id 自引用支持嵌套
 */
@Entity('folders')
// 同一人同一父级下文件夹名唯一（设计稿 §3.2）。
// 注意：PG 唯一约束对 parent_id IS NULL 不去重（根级可重名），该边缘场景由
// FoldersService 在创建/改名前显式查重兜底（typeorm 0.3.31 不再支持表达式索引装饰器）
@Index('uq_folders_owner_parent_name', ['owner_id', 'parent_id', 'name'], {
  unique: true,
})
export class Folder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  /** NULL = 根级文件夹 */
  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Folder | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
