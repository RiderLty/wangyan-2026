import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Folder } from './folder.entity';
import { User } from '../users/user.entity';

/**
 * 笔记表实体（database-design.md §3.6 / 论文 4.3.5）—— 全库枢纽
 *
 * 正文与 CRDT 的分工（D-007 核心，论文 4.4.2）：
 * - content  JSONB = ProseMirror 文档快照 → 列表 / 搜索 / 导出 / 版本（满足"正文 JSONB"锁定约束）
 * - content_text    = 由 content 派生的纯文本，全文检索载体（受控反规范化 R1）
 * - yjs_updates 表  = 实时协作的 CRDT 增量（5.4 模块落地，定时合并回写 content）
 */
@Entity('notes')
@Index('idx_notes_owner', ['owner_id', 'deleted_at'])
@Index('idx_notes_team', ['team_id', 'deleted_at'])
@Index('idx_notes_folder', ['folder_id'])
// 团队笔记没有个人文件夹归属（设计稿 §3.6 CHECK）
@Check('chk_notes_team_folder', '"team_id" IS NULL OR "folder_id" IS NULL')
@Check(
  'chk_notes_visibility',
  `"visibility" IN ('private', 'team_read', 'team_edit')`,
)
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  owner_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  /** NULL = 个人笔记；非空 = 团队笔记。FK→teams 在 5.5 teams 实体落地时补建 */
  @Column({ type: 'uuid', nullable: true })
  team_id: string | null;

  /** 仅个人笔记使用（5.3.3 文件夹管理） */
  @Column({ type: 'uuid', nullable: true })
  folder_id: string | null;

  @ManyToOne(() => Folder, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'folder_id' })
  folder: Folder | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** ProseMirror 文档 JSON（论文 2.3.1 PostgreSQL JSONB） */
  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  /** 由 content 派生的纯文本，保存时服务层同步维护（反规范化 R1，支撑 5.3.4 搜索） */
  @Column({ type: 'text', default: '' })
  content_text: string;

  /** 团队笔记的成员级权限（4.5.2/4.5.3，5.5 起使用） */
  @Column({ type: 'varchar', length: 20, default: 'private' })
  visibility: 'private' | 'team_read' | 'team_edit';

  /** 软删标记（5.7.3 回收站）；业务查询一律过滤 IS NULL */
  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
