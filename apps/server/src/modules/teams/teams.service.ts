import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { TeamInvitation, INVITATION_TTL_DAYS } from './team-invitation.entity';
import { Note } from '../notes/note.entity';
import { User } from '../users/user.entity';
import { CreateTeamDto, InviteMemberDto, SetMemberRoleDto, UpdateTeamDto } from './dto/team.dto';

/** 我的角色在团队内的权限级别（论文 4.5.1 RBAC / 4.5.3 团队级权限） */
export type TeamRole = 'owner' | 'admin' | 'member';

/**
 * 团队服务（论文 5.5.1 创建与管理 / 5.5.2 邀请与审批 / 5.5.3 权限分配）
 * RBAC 约定（论文 4.5.3）：
 * - owner：全部权限（改名/删团队/调整角色/移除成员/管理所有笔记）
 * - admin：成员与笔记管理（不可删团队、不可改 owner）
 * - member：查看非私有笔记、编辑 team_edit 笔记、退队
 */
@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team) private readonly teamsRepo: Repository<Team>,
    @InjectRepository(TeamMember) private readonly membersRepo: Repository<TeamMember>,
    @InjectRepository(TeamInvitation) private readonly invitationsRepo: Repository<TeamInvitation>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {}

  // ---------- 通用校验 ----------

  /** 取我在团队中的角色；非成员返回 null */
  async myRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const m = await this.membersRepo.findOne({
      where: { team_id: teamId, user_id: userId },
      select: ['role'],
    });
    return (m?.role as TeamRole) ?? null;
  }

  /** 要求我是成员且角色满足条件 */
  private async assertRole(
    teamId: string,
    userId: string,
    allowed: TeamRole[],
  ): Promise<TeamRole> {
    const role = await this.myRole(teamId, userId);
    if (!role || !allowed.includes(role)) {
      throw new ForbiddenException('没有该团队的操作权限');
    }
    return role;
  }

  async getTeam(teamId: string): Promise<Team> {
    const team = await this.teamsRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('团队不存在');
    return team;
  }

  // ---------- 团队 CRUD（5.5.1） ----------

  async create(userId: string, dto: CreateTeamDto): Promise<Team> {
    // R4 双重表达：teams.owner_id 与 team_members(owner行) 由服务层同事务保证一致
    return this.teamsRepo.manager.transaction(async (em) => {
      const team = await em.save(Team, {
        name: dto.name.trim(),
        description: dto.description ?? null,
        owner_id: userId,
      });
      await em.save(TeamMember, { team_id: team.id, user_id: userId, role: 'owner' });
      return team;
    });
  }

  /** 我参与的团队（含角色/成员数/笔记数——视图 v_team_overview 的等价查询） */
  async listMine(userId: string) {
    return this.membersRepo
      .createQueryBuilder('m')
      .innerJoin(Team, 't', 't.id = m.team_id')
      .where('m.user_id = :userId', { userId })
      .select(['t.id AS id', 't.name AS name', 't.description AS description'])
      .addSelect('m.role', 'my_role')
      .addSelect('t.owner_id = :userId', 'is_owner')
      .addSelect(
        `(SELECT COUNT(*) FROM team_members x WHERE x.team_id = t.id)`,
        'member_count',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM notes n WHERE n.team_id = t.id AND n.deleted_at IS NULL)`,
        'note_count',
      )
      .setParameter('userId', userId)
      .orderBy('t.name', 'ASC')
      .getRawMany();
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto): Promise<Team> {
    await this.assertRole(teamId, userId, ['owner', 'admin']);
    const team = await this.getTeam(teamId);
    if (dto.name !== undefined) team.name = dto.name.trim();
    if (dto.description !== undefined) team.description = dto.description;
    return this.teamsRepo.save(team);
  }

  /** 仅 owner 可解散；仍有笔记时禁止（与文件夹删除同一防误删策略） */
  async remove(userId: string, teamId: string): Promise<void> {
    await this.assertRole(teamId, userId, ['owner']);
    const noteCount = await this.notesRepo.count({
      where: { team_id: teamId, deleted_at: IsNull() },
    });
    if (noteCount > 0) {
      throw new BadRequestException('团队下还有笔记，请先删除或转移');
    }
    await this.teamsRepo.delete(teamId); // 成员/邀请经 FK 级联清理
  }

  // ---------- 成员管理（5.5.1） ----------

  async listMembers(teamId: string, userId: string) {
    await this.assertRole(teamId, userId, ['owner', 'admin', 'member']);
    return this.membersRepo
      .createQueryBuilder('m')
      .innerJoin(User, 'u', 'u.id = m.user_id')
      .where('m.team_id = :teamId', { teamId })
      .select(['m.user_id AS user_id', 'm.role AS role', 'm.joined_at AS joined_at'])
      .addSelect('u.username AS username')
      .addSelect('u.email AS email')
      .addSelect('u.avatar_url AS avatar_url')
      .orderBy(`CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END`, 'ASC')
      .addOrderBy('m.joined_at', 'ASC')
      .getRawMany();
  }

  /** 调整角色（仅 owner；不可改 owner 自己的角色） */
  async setMemberRole(userId: string, teamId: string, targetUserId: string, dto: SetMemberRoleDto) {
    await this.assertRole(teamId, userId, ['owner']);
    const target = await this.membersRepo.findOne({
      where: { team_id: teamId, user_id: targetUserId },
    });
    if (!target) throw new NotFoundException('该用户不是团队成员');
    if (target.role === 'owner') throw new BadRequestException('不能修改团队创建者的角色');
    target.role = dto.role;
    await this.membersRepo.save(target);
    return { user_id: targetUserId, role: target.role };
  }

  /**
   * 移除成员：owner/admin 可移除他人；任何人可移除自己（退队）；
   * owner 不可被移除（含自己退队——先转让或解散）
   */
  async removeMember(userId: string, teamId: string, targetUserId: string): Promise<void> {
    const myRole = await this.assertRole(teamId, userId, ['owner', 'admin', 'member']);
    const target = await this.membersRepo.findOne({
      where: { team_id: teamId, user_id: targetUserId },
    });
    if (!target) throw new NotFoundException('该用户不是团队成员');
    if (target.role === 'owner') throw new BadRequestException('团队创建者不能被移除');
    if (myRole === 'member' && userId !== targetUserId) {
      throw new ForbiddenException('成员只能移除自己（退队）');
    }
    if (myRole === 'admin' && target.role === 'admin' && userId !== targetUserId) {
      throw new ForbiddenException('管理员只能移除普通成员');
    }
    await this.membersRepo.delete(target.id);
  }

  // ---------- 邀请与审批（5.5.2） ----------

  /** 发出邀请（owner/admin）；重复 pending → 409；非 pending 旧行复用（重置为 pending） */
  async invite(userId: string, teamId: string, dto: InviteMemberDto) {
    await this.assertRole(teamId, userId, ['owner', 'admin']);
    const email = dto.email.trim().toLowerCase();
    if (await this.usersRepo.findOne({ where: { email }, select: ['id'] })) {
      const existingMember = await this.membersRepo
        .createQueryBuilder('m')
        .innerJoin(User, 'u', 'u.id = m.user_id')
        .where('m.team_id = :teamId', { teamId })
        .andWhere('u.email = :email', { email })
        .getOne();
      if (existingMember) throw new BadRequestException('该用户已是团队成员');
    }
    const existing = await this.invitationsRepo.findOne({
      where: { team_id: teamId, invitee_email: email },
    });
    if (existing?.status === 'pending') {
      throw new BadRequestException('已存在待处理的邀请');
    }
    const invitee = await this.usersRepo.findOne({ where: { email }, select: ['id'] });
    const payload = {
      team_id: teamId,
      inviter_id: userId,
      invitee_email: email,
      invitee_id: invitee?.id ?? null,
      status: 'pending' as const,
      expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * 86400_000),
    };
    // 复用非 pending 旧行（UNIQUE(team_id, invitee_email) 约束）
    const saved = existing
      ? await this.invitationsRepo.save({ ...existing, ...payload })
      : await this.invitationsRepo.save(payload);
    return { id: saved.id, invitee_email: saved.invitee_email, status: saved.status, expires_at: saved.expires_at };
  }

  /** 我收到的待处理邀请（邮箱或关联 id 命中且未过期） */
  async myInvitations(userId: string, email: string) {
    return this.invitationsRepo
      .createQueryBuilder('i')
      .innerJoin(Team, 't', 't.id = i.team_id')
      .leftJoin(User, 'iu', 'iu.id = i.inviter_id')
      .where('i.status = :status', { status: 'pending' })
      .andWhere('i.expires_at > now()')
      .andWhere('(i.invitee_id = :userId OR i.invitee_email = :email)', { userId, email })
      .select(['i.id AS id', 'i.invitee_email AS invitee_email', 'i.expires_at AS expires_at'])
      .addSelect('t.name AS team_name')
      .addSelect('iu.username AS inviter_name')
      .getRawMany();
  }

  /** 接受邀请：pending + 未过期 + 我是收件人 → 插入 team_members */
  async accept(userId: string, email: string, invitationId: string) {
    const inv = await this.invitationsRepo.findOne({ where: { id: invitationId } });
    if (!inv || inv.invitee_id !== userId && inv.invitee_email !== email) {
      throw new NotFoundException('邀请不存在');
    }
    if (inv.status !== 'pending') throw new BadRequestException('邀请已处理');
    if (inv.expires_at.getTime() < Date.now()) throw new BadRequestException('邀请已过期');
    const already = await this.membersRepo.findOne({
      where: { team_id: inv.team_id, user_id: userId },
    });
    if (already) {
      // 邮箱被他人复用等边缘场景：幂等接受
      await this.invitationsRepo.update(inv.id, { status: 'accepted', invitee_id: userId });
      return { team_id: inv.team_id };
    }
    await this.invitationsRepo.manager.transaction(async (em) => {
      await em.update(TeamInvitation, inv.id, { status: 'accepted', invitee_id: userId });
      await em.insert(TeamMember, { team_id: inv.team_id, user_id: userId, role: 'member' });
    });
    return { team_id: inv.team_id };
  }

  /** 拒绝邀请（收件人） */
  async decline(userId: string, email: string, invitationId: string): Promise<void> {
    const inv = await this.invitationsRepo.findOne({ where: { id: invitationId } });
    if (!inv || (inv.invitee_id !== userId && inv.invitee_email !== email)) {
      throw new NotFoundException('邀请不存在');
    }
    if (inv.status !== 'pending') throw new BadRequestException('邀请已处理');
    await this.invitationsRepo.update(inv.id, { status: 'declined' });
  }

  /** 撤回邀请（owner/admin） */
  async cancel(userId: string, teamId: string, invitationId: string): Promise<void> {
    await this.assertRole(teamId, userId, ['owner', 'admin']);
    const inv = await this.invitationsRepo.findOne({
      where: { id: invitationId, team_id: teamId },
    });
    if (!inv) throw new NotFoundException('邀请不存在');
    if (inv.status !== 'pending') throw new BadRequestException('邀请已处理');
    await this.invitationsRepo.update(inv.id, { status: 'cancelled' });
  }

  /** 团队的邀请记录（owner/admin 可见） */
  async listTeamInvitations(userId: string, teamId: string) {
    await this.assertRole(teamId, userId, ['owner', 'admin']);
    return this.invitationsRepo.find({
      where: { team_id: teamId, status: Not('cancelled') },
      select: ['id', 'invitee_email', 'status', 'created_at', 'expires_at'],
      order: { created_at: 'DESC' },
    });
  }

  // ---------- 团队笔记（5.5.3，论文 4.5.2 笔记级权限） ----------

  /**
   * 团队笔记列表（成员可见）：
   * owner/admin 见全部；member 见 非私有 + 自己创建的
   */
  async listNotes(userId: string, teamId: string, keyword?: string) {
    await this.assertRole(teamId, userId, ['owner', 'admin', 'member']);
    const role = await this.myRole(teamId, userId);
    const qb = this.notesRepo
      .createQueryBuilder('n')
      .where('n.team_id = :teamId', { teamId })
      .andWhere('n.deleted_at IS NULL');
    if (role !== 'owner' && role !== 'admin') {
      qb.andWhere('(n.visibility != :private OR n.owner_id = :userId)', {
        private: 'private',
        userId,
      });
    }
    if (keyword?.trim()) {
      const kw = `%${keyword.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(n.title ILIKE :kw OR n.content_text ILIKE :kw)', { kw });
    }
    return qb
      .select(['n.id', 'n.title', 'n.visibility', 'n.owner_id', 'n.created_at', 'n.updated_at'])
      .orderBy('n.updated_at', 'DESC')
      .getMany();
  }
}
