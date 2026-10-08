import { Body, Controller, Post, Request, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import { AgentService } from '../agent.service';
import type { Response } from 'express';

/**
 * Agent 对话接口（论文 5.10.3，v2.0 计划 L4）——POST + SSE。
 * 事件：meta {conversation_id} / delta {text} / tool_call {name,args} /
 *       tool_result {name,ok,summary} / done / error；终止帧 data: [DONE]。
 * 工具调用以当前用户身份执行并受 RBAC 约束（ai/agent/tools.ts 收敛规则）。
 */
class AgentChatDto {
  @IsOptional()
  @IsUUID()
  conversation_id?: string;

  /** 关联笔记（编辑器内发起时携带，仅作会话归属记录） */
  @IsOptional()
  @IsUUID()
  note_id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}

@Controller('ai/agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly agentService: AgentService,
  ) {}

  @Post('chat')
  async chat(
    @Request() req: { user: { id: string } },
    @Body() dto: AgentChatDto,
    @Res() res: Response,
  ) {
    if (!this.gateway.isConfigured()) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY），请联系管理员');
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // NAS nginx 反代禁缓冲
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      for await (const ev of this.agentService.run(req.user.id, dto)) {
        const { type, ...payload } = ev;
        send(type, payload);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      send('error', { message: `Agent 异常: ${(err as Error).message}` });
    } finally {
      res.end();
    }
  }
}
