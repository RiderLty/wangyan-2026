import { Body, Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/create-tag.dto';

/** 标签接口（论文 5.3.3 双维度分类） */
@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateTagDto) {
    return this.tagsService.create(req.user.id, dto);
  }

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.tagsService.list(req.user.id);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.tagsService.remove(req.user.id, id);
    return { success: true };
  }
}
