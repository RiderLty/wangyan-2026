import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamsService } from './teams.service';
import { CreateTeamDto, InviteMemberDto, SetMemberRoleDto, UpdateTeamDto } from './dto/team.dto';

/**
 * 团队接口（论文 4.6.3 团队管理接口 / 5.5）
 * 权限校验（RBAC）在 TeamsService.assertRole 完成
 */
@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  // ---------- 团队 CRUD（5.5.1） ----------

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(req.user.id, dto);
  }

  /** 我参与的团队（含 my_role / member_count / note_count） */
  @Get()
  listMine(@Request() req: { user: { id: string } }) {
    return this.teamsService.listMine(req.user.id);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.teamsService.remove(req.user.id, id);
    return { success: true };
  }

  // ---------- 成员（5.5.1） ----------

  @Get(':id/members')
  listMembers(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.teamsService.listMembers(id, req.user.id);
  }

  @Patch(':id/members/:userId')
  setMemberRole(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @Body() dto: SetMemberRoleDto,
  ) {
    return this.teamsService.setMemberRole(req.user.id, id, targetUserId, dto);
  }

  /** 移除成员 / 退队（传自己的 userId 即退队） */
  @Delete(':id/members/:userId')
  @HttpCode(200)
  async removeMember(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.teamsService.removeMember(req.user.id, id, targetUserId);
    return { success: true };
  }

  // ---------- 团队笔记（5.5.3） ----------

  @Get(':id/notes')
  listNotes(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.teamsService.listNotes(req.user.id, id, keyword);
  }

  // ---------- 邀请（5.5.2） ----------

  @Post(':id/invitations')
  invite(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.invite(req.user.id, id, dto);
  }

  @Get(':id/invitations')
  listTeamInvitations(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.teamsService.listTeamInvitations(req.user.id, id);
  }

  @Post(':id/invitations/:invitationId/cancel')
  @HttpCode(200)
  async cancelInvitation(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ) {
    await this.teamsService.cancel(req.user.id, id, invitationId);
    return { success: true };
  }
}
