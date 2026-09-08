import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Note } from './note.entity';
import { Folder } from './folder.entity';
import { Tag } from './tag.entity';
import { NoteTag } from './note-tag.entity';
import { RecycleBin } from './recycle-bin.entity';
import { NotesController } from './notes.controller';
import { FoldersController } from './folders.controller';
import { TagsController } from './tags.controller';
import { NotesService } from './notes.service';
import { FoldersService } from './folders.service';
import { TagsService } from './tags.service';

/** 个人笔记管理模块（论文 5.3）：笔记 CRUD / 文件夹 / 标签 / 搜索 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Note, Folder, Tag, NoteTag, RecycleBin]),
  ],
  controllers: [NotesController, FoldersController, TagsController],
  providers: [NotesService, FoldersService, TagsService],
})
export class NotesModule {}
