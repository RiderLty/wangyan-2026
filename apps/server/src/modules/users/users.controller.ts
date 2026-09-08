import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

/** 用户接口（论文 4.6.1 用户认证接口） */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /api/users/me —— 当前登录用户信息（路由守卫保护，论文 5.2.3） */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findSafeById(req.user.id);
    return user.toSafe();
  }
}
