import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsPositive } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VersionsService } from './versions.service';

export class RollbackDto {
  @IsInt()
  @IsPositive()
  version_no: number;
}

/** 版本接口（论文 5.7.1 版本历史 / 5.7.2 回滚与恢复） */
@Controller('notes/:noteId/versions')
@UseGuards(JwtAuthGuard)
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  /** 手动保存当前状态为版本 */
  @Post()
  saveManual(
    @Request() req: { user: { id: string } },
    @Param('noteId') noteId: string,
  ) {
    return this.versionsService.saveManual(req.user.id, noteId);
  }

  @Get()
  list(@Request() req: { user: { id: string } }, @Param('noteId') noteId: string) {
    return this.versionsService.list(req.user.id, noteId);
  }

  @Get(':versionNo')
  detail(
    @Request() req: { user: { id: string } },
    @Param('noteId') noteId: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
  ) {
    return this.versionsService.detail(req.user.id, noteId, versionNo);
  }

  /** 回滚到指定版本（回滚前自动快照 source=rollback） */
  @Post('rollback')
  rollback(
    @Request() req: { user: { id: string } },
    @Param('noteId') noteId: string,
    @Body() dto: RollbackDto,
  ) {
    return this.versionsService.rollback(req.user.id, noteId, dto.version_no);
  }
}
