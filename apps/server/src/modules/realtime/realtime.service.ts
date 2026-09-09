import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { WebSocketServer } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'http';
import type { Duplex } from 'stream';
import type { WebSocket as WsSocket } from 'ws';
import { setPersistence, setupWSConnection } from 'y-websocket/bin/utils';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { Repository } from 'typeorm';
import { CollaborationPersistence } from './collaboration.persistence';

/**
 * 实时协作服务（论文 5.4.1 WebSocket 服务端实现）
 *
 * 采用 y-websocket 参考实现（setupWSConnection）处理 y-protocols 同步与 awareness，
 * 并把它挂到 NestJS 的 HTTP server 上（路径 /ws/:noteId）——与 REST 共用端口与进程，
 * 论文 4.1.1 总体架构中"网关层"的体现。
 *
 * 鉴权（论文 4.5.2）：浏览器 WebSocket 无法自定义请求头，token 走查询参数，
 * upgrade 握手期完成 JWT 校验与笔记归属校验，未通过直接 401 关闭。
 * 5.4 阶段仅个人笔记（owner 本人可协作）；团队笔记权限在 5.5 扩展此处。
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly wss = new WebSocketServer({ noServer: true });

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(TeamMember) private readonly membersRepo: Repository<TeamMember>,
    private readonly persistence: CollaborationPersistence,
  ) {}

  attachCollaboration(httpServer: HttpServer): void {
    setPersistence(this.persistence);

    httpServer.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', 'http://internal');
      const match = /^\/ws\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (!match) {
        socket.destroy();
        return;
      }
      const noteId = match[1];
      const token = url.searchParams.get('token') ?? '';

      // 握手期鉴权（论文 4.5.2/4.5.3，与 REST 层 RBAC 对齐）：
      // 笔记 owner、团队 owner/admin 恒可协作；普通成员须 visibility=team_edit
      // （team_read/private 成员拒绝连接——y-websocket 无法限制只读写穿，论文 5.5.3 说明）
      let allowed = false;
      try {
        const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
        const note = await this.notesRepo.findOne({
          where: { id: noteId },
          select: ['id', 'owner_id', 'team_id', 'visibility', 'deleted_at'],
        });
        if (note && note.deleted_at === null) {
          if (note.owner_id === payload.sub) {
            allowed = true;
          } else if (note.team_id) {
            const member = await this.membersRepo.findOne({
              where: { team_id: note.team_id, user_id: payload.sub },
              select: ['role'],
            });
            allowed =
              member?.role === 'owner' ||
              member?.role === 'admin' ||
              (!!member && note.visibility === 'team_edit');
          }
        }
      } catch {
        allowed = false;
      }
      if (!allowed) {
        this.logger.warn(`[协作] 拒绝 WebSocket 连接：note=${noteId}`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // ws 的 handleUpgrade 形参声明为其 WebSocket 类型，运行期即 Node 的 Duplex
      this.wss.handleUpgrade(req, socket as never, head, (conn) => {
        setupWSConnection(conn, req, { docName: noteId });
      });
    });

    this.logger.log('[协作] Yjs WebSocket 已挂载：/ws/:noteId');
  }
}
