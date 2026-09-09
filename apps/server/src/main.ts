import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { RealtimeService } from './modules/realtime/realtime.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 统一 RESTful 前缀（论文 2.2.2 RESTful API 设计）
  app.setGlobalPrefix('api');

  // 全局参数校验（配合 class-validator，论文 3.4.2 安全性需求）
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.enableCors({ origin: true, credentials: true });

  // 挂载实时协作 WebSocket（论文 5.4.1）：与 REST 共用 HTTP server，路径 /ws/:noteId
  await app.init();
  app.get(RealtimeService).attachCollaboration(app.getHttpServer());

  const port = process.env.SERVER_PORT ?? 3000;
  await app.listen(port);
  console.log(`[server] 已启动: http://localhost:${port}/api`);
}

bootstrap();
