import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ShareModule } from '../share/share.module';
import { Note } from '../notes/note.entity';
import { NoteVersion } from '../notes/note-version.entity';
import { TeamMember } from '../teams/team-member.entity';
import { YjsUpdate } from './yjs-update.entity';
import { RealtimeService } from './realtime.service';
import { CollaborationPersistence } from './collaboration.persistence';

/** 实时协作模块（论文 5.4）：WebSocket 同步 + Yjs 增量持久化 + 快照合并 + 会话结束自动建版 */
@Module({
  // 复用 AuthModule 的 JwtModule（同一密钥校验握手 token）；ShareModule 提供访客协作鉴权（5.6.2）
  imports: [
    TypeOrmModule.forFeature([Note, NoteVersion, TeamMember, YjsUpdate]),
    AuthModule,
    ShareModule,
  ],
  providers: [RealtimeService, CollaborationPersistence],
  exports: [RealtimeService],
})
export class RealtimeModule {}
