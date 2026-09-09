import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { YjsUpdate } from './yjs-update.entity';
import { RealtimeService } from './realtime.service';
import { CollaborationPersistence } from './collaboration.persistence';

/** 实时协作模块（论文 5.4）：WebSocket 同步 + Yjs 增量持久化 + 快照合并 */
@Module({
  // 复用 AuthModule 导出的已配置 JwtModule（同一密钥校验握手 token）
  imports: [TypeOrmModule.forFeature([Note, TeamMember, YjsUpdate]), AuthModule],
  providers: [RealtimeService, CollaborationPersistence],
  exports: [RealtimeService],
})
export class RealtimeModule {}
