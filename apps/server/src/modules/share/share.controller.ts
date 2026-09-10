import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShareService } from './share.service';

export class CreateShareDto {
  @IsUUID()
  note_id: string;

  @IsIn(['read', 'edit'])
  permission: 'read' | 'edit';

  /** 有效期；缺省/null = 永久（5.6.3） */
  @IsOptional()
  @IsISO8601()
  expires_at?: string | null;
}

export class UpdateShareDto {
  @IsOptional()
  @IsIn(['read', 'edit'])
  permission?: 'read' | 'edit';

  @IsOptional()
  @IsISO8601()
  expires_at?: string | null;
}

/** 分享链接管理接口（需登录，论文 5.6.1/5.6.3） */
@Controller('share')
@UseGuards(JwtAuthGuard)
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  @Post()
  create(@Request() req: { user: { id: string } }, @Body() dto: CreateShareDto) {
    return this.shareService.create(
      req.user.id,
      dto.note_id,
      dto.permission,
      dto.expires_at ? new Date(dto.expires_at) : null,
    );
  }

  @Get()
  list(@Request() req: { user: { id: string } }, @Query('note_id') noteId: string) {
    return this.shareService.list(req.user.id, noteId);
  }

  @Patch(':id')
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateShareDto,
  ) {
    return this.shareService.update(req.user.id, id, {
      permission: dto.permission,
      expires_at: 'expires_at' in dto ? (dto.expires_at ? new Date(dto.expires_at) : null) : undefined,
    });
  }

  /** 停用/恢复（is_enabled 独立路由，语义更清晰） */
  @Patch(':id/enabled')
  setEnabled(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: { is_enabled: boolean },
  ) {
    return this.shareService.update(req.user.id, id, { is_enabled: !!dto.is_enabled });
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.shareService.remove(req.user.id, id);
    return { success: true };
  }
}
