import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganizeService } from './organize.service';
import { AiConversation } from '../conversation/ai-conversation.entity';
import { AiMessage } from '../conversation/ai-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

/**
 * AI 整理 / 会话历史 / 审计接口（论文 5.10 L2 与审计，v2.0 计划 M3）
 * 全部需登录；整理与标签采纳复用笔记级 RBAC。
 */
class ApplyTagsDto {
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  tags!: string[];
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class OrganizeController {
  constructor(
    private readonly organizeService: OrganizeService,
    @InjectRepository(AiConversation) private readonly convRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage) private readonly msgRepo: Repository<AiMessage>,
  ) {}

  /** GET /ai/notes/:id/meta —— 摘要卡与标签建议（可空对象） */
  @Get('notes/:id/meta')
  async meta(@Param('id') noteId: string) {
    return (await this.organizeService.getMeta(noteId)) ?? { note_id: noteId, summary: null, suggested_tags: null };
  }

  /** POST /ai/notes/:id/organize —— 生成/刷新摘要与标签建议 */
  @Post('notes/:id/organize')
  async organize(@Request() req: { user: { id: string } }, @Param('id') noteId: string) {
    return this.organizeService.organize(req.user.id, noteId);
  }

  /** POST /ai/notes/:id/apply-tags —— 建议标签一键采纳（复用 5.3.3 标签体系） */
  @Post('notes/:id/apply-tags')
  async applyTags(@Request() req: { user: { id: string } }, @Param('id') noteId: string, @Body() dto: ApplyTagsDto) {
    return { attached: await this.organizeService.applyTags(req.user.id, noteId, dto.tags) };
  }

  /** POST /ai/organize/batch —— 启动存量批量整理（后台顺序执行） */
  @Post('organize/batch')
  startBatch(@Request() req: { user: { id: string } }) {
    return this.organizeService.startBatch(req.user.id);
  }

  /** GET /ai/organize/batch/status —— 批量进度轮询 */
  @Get('organize/batch/status')
  batchStatus(@Request() req: { user: { id: string } }) {
    return this.organizeService.getBatchStatus(req.user.id) ?? { running: false, total: 0, done: 0, failed: 0 };
  }

  /** GET /ai/conversations?note_id= —— 会话列表（抽屉重开时恢复最近会话） */
  @Get('conversations')
  async listConversations(@Request() req: { user: { id: string } }, @Query('note_id') noteId?: string) {
    return this.convRepo.find({
      where: { user_id: req.user.id, ...(noteId ? { note_id: noteId } : {}) },
      order: { updated_at: 'DESC' },
      take: 20,
    });
  }

  /** GET /ai/conversations/:id/messages —— 会话消息回放（tool 结果并回 assistant 的工具步骤） */
  @Get('conversations/:id/messages')
  async conversationMessages(@Request() req: { user: { id: string } }, @Param('id') conversationId: string) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId, user_id: req.user.id } });
    if (!conv) return [];
    const msgs = await this.msgRepo.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
      take: 200,
    });
    // 工具结果（role=tool）按 tool_call_id 并回发起调用的 assistant 消息
    const resultByCallId = new Map(msgs.filter((m) => m.role === 'tool').map((m) => [m.tool_call_id, m.content]));
    return msgs
      .filter((m) => m.role !== 'tool')
      .map((m) => ({
        role: m.role,
        content: m.content,
        created_at: m.created_at,
        ...(m.tool_calls
          ? {
              tools: m.tool_calls.map((tc) => {
                const resultText = resultByCallId.get(tc.id);
                let ok = true;
                try {
                  ok = !(resultText && JSON.parse(resultText).error);
                } catch {
                  /* 非 JSON 结果按成功处理 */
                }
                return { name: tc.function.name, args: tc.function.arguments, ok, summary: resultText ?? '' };
              }),
            }
          : {}),
      }));
  }

  /** GET /ai/audit —— 当前用户最近的工具调用审计（谁、何时、调了什么、结果） */
  @Get('audit')
  async audit(@Request() req: { user: { id: string } }) {
    const convs = await this.convRepo.find({ where: { user_id: req.user.id }, select: ['id'], take: 50 });
    if (!convs.length) return [];
    const msgs = await this.msgRepo.find({
      where: { conversation_id: In(convs.map((c) => c.id)) },
      order: { created_at: 'DESC' },
      take: 200,
    });
    const rows: Array<{ time: string; name: string; args: string; ok: boolean; result: string }> = [];
    const resultMap = new Map(msgs.filter((m) => m.role === 'tool').map((m) => [m.tool_call_id, m]));
    for (const m of msgs) {
      if (!m.tool_calls) continue;
      for (const tc of m.tool_calls) {
        const result = resultMap.get(tc.id);
        let ok = true;
        let resultText = '';
        if (result?.content) {
          try {
            ok = !JSON.parse(result.content).error;
            resultText = result.content.slice(0, 160);
          } catch {
            resultText = result.content.slice(0, 160);
          }
        }
        rows.push({ time: m.created_at.toISOString(), name: tc.function.name, args: tc.function.arguments.slice(0, 120), ok, result: resultText });
      }
    }
    return rows.slice(0, 50);
  }
}
