import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Team } from './team.entity';
import { User } from '../users/user.entity';

/**
 * 团队成员表实体（database-design.md §3.4 / 论文 4.3.4）
 * RBAC 角色落点（论文 4.5.1）：owner（创建者）/ admin（管理员）/ member（成员）
 * 只有接受邀请后才落此表；"待审批"状态属于 team_invitations（生命周期不同）
 */
@Entity('team_members')
@Index('uq_team_members_team_user', ['team_id', 'user_id'], { unique: true })
@Check('chk_team_members_role', `"role" IN ('owner', 'admin', 'member')`)
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** 成员角色（论文 4.5.1 RBAC）：owner（创建者）/ admin（管理员）/ member（成员） */
  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: 'owner' | 'admin' | 'member';

  @Column({ type: 'uuid' })
  team_id: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team: Team | null;

  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  joined_at: Date;
}
