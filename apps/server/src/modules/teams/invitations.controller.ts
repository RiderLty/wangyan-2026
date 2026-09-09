import { Controller, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TeamsService } from './teams.service';

/**
 * 收件人视角的邀请接口（论文 5.5.2 邀请与审批）
 * 独立控制器避免与 /teams/:id/... 路由混淆
 */
@Controller('teams/invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly teamsService: TeamsService) {}

  /** 我收到的待处理邀请 */
  @Get('mine')
  mine(@Request() req: { user: { id: string; email: string } }) {
    return this.teamsService.myInvitations(req.user.id, req.user.email);
  }

  @Post(':invitationId/accept')
  accept(@Request() req: { user: { id: string; email: string } }, @Param('invitationId') id: string) {
    return this.teamsService.accept(req.user.id, req.user.email, id);
  }

  @Post(':invitationId/decline')
  @HttpCode(200)
  async decline(
    @Request() req: { user: { id: string; email: string } },
    @Param('invitationId') id: string,
  ) {
    await this.teamsService.decline(req.user.id, req.user.email, id);
    return { success: true };
  }
}
