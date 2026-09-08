import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 认证守卫（论文 5.2.3 路由守卫与身份校验）
 * 用法：@UseGuards(JwtAuthGuard)，通过后 req.user 为脱敏用户对象
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
