import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoldersService } from './folders.service';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder.dto';

/** 文件夹接口（论文 5.3.3 分类与文件夹管理） */
@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateFolderDto) {
    return this.foldersService.create(req.user.id, dto);
  }

  /** 平铺列表，前端组装树 */
  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.foldersService.list(req.user.id);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.foldersService.remove(req.user.id, id);
    return { success: true };
  }
}
