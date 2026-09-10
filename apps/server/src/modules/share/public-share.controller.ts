import { Controller, Get, Param } from '@nestjs/common';
import { ShareService } from './share.service';

/**
 * 访客公开接口（无需登录，论文 5.6.2 链接访问权限控制）
 * 失效/停用/过期/笔记已删统一 404，不区分原因防枚举
 */
@Controller('public/share')
export class PublicShareController {
  constructor(private readonly shareService: ShareService) {}

  /** 校验 token 有效性（公开页首屏） */
  @Get(':token')
  async resolve(@Param('token') token: string) {
    return this.shareService.resolveByToken(token);
  }

  /** 正文快照（含访问计数 +1） */
  @Get(':token/content')
  async content(@Param('token') token: string) {
    const entry = await this.shareService.resolveByToken(token);
    return this.shareService.getSharedContent(entry.note_id);
  }
}
