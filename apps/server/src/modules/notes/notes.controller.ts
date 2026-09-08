import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteQueryDto } from './dto/note-query.dto';
import { AttachTagDto } from './dto/attach-tag.dto';

/**
 * 笔记接口（论文 4.6.2 笔记管理接口 / 5.3）
 * 全部需登录；本阶段仅个人空间（owner 校验在 Service 层）
 */
@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** POST /api/notes —— 新建笔记（5.3.1） */
  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateNoteDto) {
    return this.notesService.create(req.user.id, dto);
  }

  /** GET /api/notes?folder_id=&tag_id=&keyword= —— 列表 / 搜索（5.3.4） */
  @Get()
  list(@Request() req: { user: { id: string } }, @Query() query: NoteQueryDto) {
    return this.notesService.list(req.user.id, query);
  }

  /** GET /api/notes/:id —— 详情（含正文 JSONB） */
  @Get(':id')
  detail(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notesService.detail(req.user.id, id);
  }

  /** PATCH /api/notes/:id —— 部分更新（前端自动保存走这里） */
  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.update(req.user.id, id, dto);
  }

  /** DELETE /api/notes/:id —— 软删除进回收站（5.7.3） */
  @Delete(':id')
  @HttpCode(200)
  async remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.notesService.softDelete(req.user.id, id);
    return { success: true };
  }

  /** GET /api/notes/:id/tags —— 笔记的标签 */
  @Get(':id/tags')
  listTags(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.notesService.listTags(req.user.id, id);
  }

  /** PUT /api/notes/:id/tags —— 打标签（幂等） */
  @Put(':id/tags')
  attachTag(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: AttachTagDto,
  ) {
    return this.notesService.attachTag(req.user.id, id, dto.tag_id);
  }

  /** DELETE /api/notes/:id/tags/:tagId —— 摘标签 */
  @Delete(':id/tags/:tagId')
  detachTag(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.notesService.detachTag(req.user.id, id, tagId);
  }
}
