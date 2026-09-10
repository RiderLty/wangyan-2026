import { Controller, Delete, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecycleBinService } from './recycle-bin.service';

/** 回收站接口（论文 5.7.3，仅本人可见） */
@Controller('recycle-bin')
@UseGuards(JwtAuthGuard)
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.recycleBinService.list(req.user.id);
  }

  @Post(':id/restore')
  restore(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.recycleBinService.restore(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(200)
  async purge(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.recycleBinService.purge(req.user.id, id);
    return { success: true };
  }
}
