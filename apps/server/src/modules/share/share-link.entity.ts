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
import { Note } from '../notes/note.entity';
import { User } from '../users/user.entity';

/**
 * 分享链接表实体（database-design.md §3.12 / 论文 4.3.7，支撑 5.6）
 * token 是 URL 中暴露的唯一凭证（32 位十六进制，crypto 随机，等价 nanoid 语义）
 * 访客权限（论文 4.5.4）：token 有效（未过期 + is_enabled）→ permission 决定 read/edit
 */
@Entity('share_links')
@Index('idx_share_note', ['note_id'])
@Check('chk_share_permission', `"permission" IN ('read', 'edit')`)
export class ShareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  note_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note | null;

  @Column({ type: 'varchar', length: 32, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 20, default: 'read' })
  permission: 'read' | 'edit';

  /** NULL = 永久有效（5.6.3 有效期管理） */
  @Column({ type: 'timestamptz', nullable: true })
  expires_at: Date | null;

  /** 随时停用，不等过期 */
  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;

  /** 访问计数（公开页每次解析 +1） */
  @Column({ type: 'int', default: 0 })
  visit_count: number;

  @Column({ type: 'uuid' })
  created_by: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn()
  created_at: Date;
}
