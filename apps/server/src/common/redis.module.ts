import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Redis 连接注入令牌（论文 2.3.2 Redis 缓存与会话管理） */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * 全局 Redis 模块：按 .env 连接 NAS 上的 redis 容器（192.168.3.3:16379）。
 * 键设计见 docs/diagrams/database-design.md §7（D-007）
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: Number(config.get('REDIS_PORT', 6379)),
          password: config.get('REDIS_PASSWORD') || undefined,
          lazyConnect: false,
          maxRetriesPerRequest: 2,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
