import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { RedisModule } from './common/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { NotesModule } from './modules/notes/notes.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TeamsModule } from './modules/teams/teams.module';
import { ShareModule } from './modules/share/share.module';

/**
 * 根模块：聚合各业务模块（论文 4.1.3 模块化设计）
 * 业务模块按论文小节逐个加入：
 *   auth(5.2)✅ users(5.2)✅ notes(5.3) realtime(5.4) teams(5.5)
 *   share(5.6) versions recycle-bin(5.7) export(5.8)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('POSTGRES_HOST', 'localhost'),
        port: Number(config.get('POSTGRES_PORT', 5432)),
        username: config.get('POSTGRES_USER'),
        password: config.get('POSTGRES_PASSWORD'),
        database: config.get('POSTGRES_DB'),
        // UUID 主键用 PG13+ 内置的 gen_random_uuid()，免装 uuid-ossp 扩展
        uuidExtension: 'pgcrypto',
        // 实体在各业务模块注册后自动加载
        autoLoadEntities: true,
        // 开发期自动同步表结构；生产改用迁移（论文 4.3 数据库设计）
        synchronize: config.get('NODE_ENV', 'development') !== 'production',
      }),
    }),
    RedisModule,
    UsersModule,
    AuthModule,
    NotesModule,
    RealtimeModule,
    TeamsModule,
    ShareModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
