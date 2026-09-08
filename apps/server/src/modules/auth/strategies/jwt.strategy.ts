import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

/**
 * JWT 被动解析策略（论文 5.2.3 路由守卫与身份校验）
 * 从 Authorization: Bearer <token> 提取并验签，业务校验在 validate 中完成
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  // passport-jwt 的类型声明未导出 validate 约束，这里用动态方法保持与基类一致
  async validate(payload: { sub: string; jti: string; exp: number; username: string }) {
    return this.authService.validateToken(payload);
  }
}
