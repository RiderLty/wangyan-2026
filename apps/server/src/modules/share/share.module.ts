import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareLink } from './share-link.entity';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { ShareController } from './share.controller';
import { PublicShareController } from './public-share.controller';
import { ShareService } from './share.service';

/** 笔记分享模块（论文 5.6）：链接生成/访问控制/有效期管理 + 访客协作鉴权 */
@Module({
  imports: [TypeOrmModule.forFeature([ShareLink, Note, TeamMember])],
  controllers: [ShareController, PublicShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
