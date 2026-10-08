import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Note } from './note.entity';
import { Folder } from './folder.entity';
import { Tag } from './tag.entity';
import { NoteTag } from './note-tag.entity';
import { RecycleBin } from './recycle-bin.entity';
import { NoteVersion } from './note-version.entity';
import { TeamMember } from '../teams/team-member.entity';
import { YjsUpdate } from '../realtime/yjs-update.entity';
import { NotesController } from './notes.controller';
import { FoldersController } from './folders.controller';
import { TagsController } from './tags.controller';
import { VersionsController } from './versions.controller';
import { NotesService } from './notes.service';
import { FoldersService } from './folders.service';
import { TagsService } from './tags.service';
import { VersionsService } from './versions.service';

/** 个人笔记管理模块（论文 5.3）：笔记 CRUD / 文件夹 / 标签 / 搜索；版本管理 5.7 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Note, Folder, Tag, NoteTag, RecycleBin, TeamMember, NoteVersion, YjsUpdate]),
  ],
  controllers: [NotesController, FoldersController, TagsController, VersionsController],
  providers: [NotesService, FoldersService, TagsService, VersionsService],
  // getAccessLevel 供 ai 模块复用（AI 写入与人工编辑同权校验，v2.0 5.10）
  exports: [VersionsService, NotesService],
})
export class NotesModule {}
