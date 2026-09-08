import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.module';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/**
 * 认证服务（论文 5.2.1 注册 / 5.2.2 登录与 JWT Token 生成）
 *
 * Token 模型：单 JWT（7 天）+ jti，登出/撤销靠 Redis 黑名单（D-007 §7），
 * 不做 refresh_token 双令牌——毕业设计场景下复杂度收益比不划算。
 */
@Injectable()
export class AuthService {
  private readonly denylistPrefix = 'auth:denylist:';

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** 注册：唯一性校验 + bcrypt 哈希入库（论文 5.2.1） */
  async register(dto: RegisterDto) {
    if (await this.usersService.existsByEmail(dto.email)) {
      throw new ConflictException('该邮箱已被注册');
    }
    if (await this.usersService.existsByUsername(dto.username)) {
      throw new ConflictException('该用户名已被占用');
    }
    const password_hash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      password_hash,
    });
    return user.toSafe();
  }

  /** 登录：校验凭据 → 签发含 jti 的 JWT（论文 5.2.2） */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithHash(dto.email);
    // 统一报错信息，不区分"邮箱不存在/密码错误"，防用户枚举（论文 3.4.2）
    if (!user || !(await bcrypt.compare(dto.password, user.password_hash))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const jti = randomUUID();
    const expiresIn = this.config.get('JWT_EXPIRES_IN', '7d');
    const access_token = await this.jwtService.signAsync(
      { sub: user.id, username: user.username },
      { jwtid: jti, expiresIn },
    );
    return { access_token, user: user.toSafe() };
  }

  /** 登出：将当前 token 的 jti 拉黑至其自然过期（论文 5.2.3 会话失效） */
  async logout(jti: string, exp: number) {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(this.denylistPrefix + jti, '1', 'EX', ttl);
    }
    return { success: true };
  }

  /** JWT 策略回调：jti 黑名单检查 + 用户存在性检查（论文 5.2.3 路由守卫与身份校验） */
  async validateToken(payload: { sub: string; jti: string; exp: number }) {
    const denied = await this.redis.exists(this.denylistPrefix + payload.jti);
    if (denied) throw new UnauthorizedException('登录状态已失效');
    const user = await this.usersService.findOne(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在');
    // jti/exp 随 req.user 传递，logout 时用于计算拉黑时长
    return { ...user.toSafe(), jti: payload.jti, exp: payload.exp };
  }

  /** 供测试/管理场景使用的哈希比较（预留） */
  comparePassword(plain: string, hash: string) {
    if (!plain || !hash) throw new BadRequestException('参数缺失');
    return bcrypt.compare(plain, hash);
  }
}
