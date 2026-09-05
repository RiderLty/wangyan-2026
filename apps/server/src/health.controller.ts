import { Controller, Get } from '@nestjs/common';
import { ApiResponse } from '@app/shared';

/** 健康检查（用于 compose healthcheck 与联调验证） */
@Controller('health')
export class HealthController {
  @Get()
  check(): ApiResponse<{ status: string; service: string }> {
    return {
      code: 0,
      message: 'ok',
      data: { status: 'up', service: 'markdown-notes-server' },
    };
  }
}
