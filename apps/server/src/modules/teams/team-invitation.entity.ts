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
import { Team } from './team.entity';
import { User } from '../users/user.entity';

/**
 * 团队邀请表实体（database-design.md §3.5 / 论文 4.3.4 邀请子节，支撑 5.5.2）
 * 邀请≠成员：只有接受后才插入 team_members（两实体生命周期不同）
 * 重发邀请复用旧行（改回 pending），满足 UNIQUE(team_id, invitee_email)
 */
@Entity('team_invitations')
@Index('uq_team_invitations_team_email', ['team_id', 'invitee_email'], { unique: true })
@Check(
  'chk_team_invitations_status',
  `"status" IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')`,
)
export class TeamInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid' })
  inviter_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inviter_id' })
  inviter: User | null;

  /** 按邮箱邀请 */
  @Column({ type: 'varchar', length: 255 })
  invitee_email: string;

  /** 对方已注册则关联；NULL = 邮箱未注册（仍可留邀请，注册后可接受） */
  @Column({ type: 'uuid', nullable: true })
  invitee_id: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invitee_id' })
  invitee: User | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

  /** 过期后接受被拒；批量置 expired 属 5.7.4 定时清理 */
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;
}

/** 邀请有效期（天，论文 5.5.2/5.6.3 同类语义） */
export const INVITATION_TTL_DAYS = 7;
