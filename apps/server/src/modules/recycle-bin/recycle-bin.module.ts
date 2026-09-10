import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecycleBin } from '../notes/recycle-bin.entity';
import { Note } from '../notes/note.entity';
import { Folder } from '../notes/folder.entity';
import { TeamInvitation } from '../teams/team-invitation.entity';
import { RecycleBinController } from './recycle-bin.controller';
import { RecycleBinService } from './recycle-bin.service';
import { CleanupService } from './cleanup.service';

/** 回收站模块（论文 5.7.3/5.7.4）：软删元数据查询/恢复/彻底删除 + 定时清理 */
@Module({
  imports: [TypeOrmModule.forFeature([RecycleBin, Note, Folder, TeamInvitation])],
  controllers: [RecycleBinController],
  providers: [RecycleBinService, CleanupService],
})
export class RecycleBinModule {}
