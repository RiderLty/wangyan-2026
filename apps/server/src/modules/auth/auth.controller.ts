import { Body, Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/** 认证接口（论文 4.6.1 用户认证接口 / 5.2.4 界面背后的 API） */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** POST /api/auth/register 注册 */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** POST /api/auth/login 登录，返回 access_token + 用户信息 */
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** POST /api/auth/logout 登出：当前 token 拉黑 */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  logout(
    @Request() req: { user: { jti: string; exp: number } },
  ) {
    const { jti, exp } = req.user;
    return this.authService.logout(jti, exp);
  }
}
