import {
  Check,
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
 * 笔记版本表实体（database-design.md §3.11 / 论文 4.3.6，支撑 5.7.1/5.7.2）
 * 整份快照 = 版本管理的本质（受控反规范化 R3，空间换历史）
 * 快照策略（D-007 已确认）：手动保存 + 关键事件（回滚前、编辑会话结束且有变更），不做纯定时
 */
@Entity('note_versions')
@Index('idx_versions_note', ['note_id', 'version_no'])
@Check('chk_note_versions_source', `"source" IN ('manual', 'auto', 'rollback')`)
export class NoteVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  note_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note | null;

  /** 笔记内递增版本号 */
  @Column({ type: 'int' })
  version_no: number;

  /** 快照含标题（回滚时一并恢复） */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** 整份 ProseMirror 文档快照（JSONB） */
  @Column({ type: 'jsonb' })
  content: Record<string, unknown>;

  /** manual=手动保存 / auto=编辑会话结束且有变更 / rollback=回滚前自动快照 */
  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source: 'manual' | 'auto' | 'rollback';

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn()
  created_at: Date;
}
