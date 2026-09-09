import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './team.entity';
import { TeamMember } from './team-member.entity';
import { TeamInvitation } from './team-invitation.entity';
import { Note } from '../notes/note.entity';
import { User } from '../users/user.entity';
import { TeamsController } from './teams.controller';
import { InvitationsController } from './invitations.controller';
import { TeamsService } from './teams.service';

/** 团队协作模块（论文 5.5）：团队/成员/邀请/团队笔记权限 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember, TeamInvitation, Note, User]),
  ],
  controllers: [TeamsController, InvitationsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
