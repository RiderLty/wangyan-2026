import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotesService } from '../notes/notes.service';
import { ShareService } from '../share/share.service';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { LlmGatewayService } from './llm/llm-gateway.service';
import { ChatMessage } from './llm/llm.types';
import { AiConversation } from './conversation/ai-conversation.entity';
import { AiMessage } from './conversation/ai-message.entity';
import { buildAgentTools, AgentTool } from './agent/tools';

/**
 * Agent 服务（论文 5.10.3，v2.0 计划 6.3.4）——工具调用循环 + 权限收敛。
 *
 * 循环：用户消息 → LLM（携带工具定义）→ tool_calls → 以用户身份执行工具（过 RBAC）
 * → 结果回填 → 继续，直至模型给出最终回答或达步数上限（MAX_STEPS=6）。
 * 全部消息（含工具调用与结果）落 ai_messages，构成可审计的操作记录；
 * 会话历史回放时仅保留 user/assistant 正文（工具过程不回填上下文，规避协议悬挂）。
 */

export type AgentEvent =
  | { type: 'meta'; conversation_id: string }
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; name: string; args: string }
  | { type: 'tool_result'; name: string; ok: boolean; summary: string }
  | { type: 'done'; conversation_id: string }
  | { type: 'error'; message: string };

const MAX_STEPS = 6;
const SYSTEM_PROMPT = [
  '你是「在线 Markdown 笔记平台」的 AI 助手，可帮助用户检索、撰写、整理笔记并生成分享链接。',
  '规则：',
  '1. 工具以当前登录用户身份执行，受其权限约束——无权访问的工具会返回错误，应向用户说明而不是重试；',
  '2. 多步任务先检索（search_notes）再行动；创建/更新笔记的正文一律使用 Markdown；',
  '3. 全程使用简体中文（包括工具调用前的过程说明），不要输出英文；',
  '4. 简洁直接；完成动作后报告结果（如笔记标题、分享链接路径）。',
].join('\n');

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly tools: AgentTool[];
  private readonly toolMap: Map<string, AgentTool>;

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly notesService: NotesService,
    private readonly shareService: ShareService,
    @InjectRepository(Note) private readonly noteRepo: Repository<Note>,
    @InjectRepository(TeamMember) private readonly memberRepo: Repository<TeamMember>,
    @InjectRepository(AiConversation) private readonly convRepo: Repository<AiConversation>,
    @InjectRepository(AiMessage) private readonly msgRepo: Repository<AiMessage>,
  ) {
    this.tools = buildAgentTools({
      notesService,
      shareService,
      noteRepo: this.noteRepo,
      memberRepo: this.memberRepo,
    });
    this.toolMap = new Map(this.tools.map((t) => [t.name, t]));
  }

  /** 工具定义列表（OpenAI tools 参数格式） */
  private get toolDefinitions() {
    return this.tools.map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
  }

  /**
   * Agent 主循环（SSE 事件流）。
   * 单条用户消息触发一次 run；一次 run 内最多 MAX_STEPS 轮"生成/调用"。
   */
  async *run(
    userId: string,
    input: { conversation_id?: string; note_id?: string; message: string },
  ): AsyncGenerator<AgentEvent> {
    // ---- 会话保障 ----
    let conversation: AiConversation | null = null;
    if (input.conversation_id) {
      conversation = await this.convRepo.findOne({
        where: { id: input.conversation_id, user_id: userId },
      });
    }
    if (!conversation) {
      conversation = await this.convRepo.save({
        user_id: userId,
        note_id: input.note_id ?? null,
        title: input.message.slice(0, 30) || 'AI 助手对话',
      });
    }
    yield { type: 'meta', conversation_id: conversation.id };

    // 用户消息落库
    await this.msgRepo.save({
      conversation_id: conversation.id,
      role: 'user',
      content: input.message,
    });

    // 历史回放（仅 user/assistant 正文，工具过程不回填）
    const history = await this.msgRepo.find({
      where: { conversation_id: conversation.id },
      order: { created_at: 'ASC' },
      take: 40,
    });
    const chatHistory: ChatMessage[] = history
      .filter((m) => m.role !== 'tool')
      .slice(-16)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content ?? '',
      }));
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...chatHistory,
      { role: 'user', content: input.message },
    ];

    // ---- 工具调用循环 ----
    for (let step = 0; step < MAX_STEPS; step++) {
      let stepContent = '';
      let usage: { total_tokens?: number } | undefined;
      let calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];
      try {
        for await (const ev of this.gateway.streamChat(messages, {
          model: this.gateway.activeModel(),
          tools: this.toolDefinitions,
          temperature: 0.6,
          maxTokens: 8192,
        })) {
          if (ev.type === 'delta') {
            stepContent += ev.text;
            yield { type: 'delta', text: ev.text };
          } else if (ev.type === 'tool_calls') {
            calls = ev.calls;
          } else if (ev.type === 'usage') {
            usage = ev.usage;
          } else if (ev.type === 'error') {
            yield { type: 'error', message: ev.message };
            return;
          }
        }
      } catch (err) {
        yield { type: 'error', message: `AI 服务异常: ${(err as Error).message}` };
        return;
      }

      if (!calls.length) {
        // 最终回答：落库并结束
        await this.msgRepo.save({
          conversation_id: conversation.id,
          role: 'assistant',
          content: stepContent,
          model: this.gateway.activeModel(),
          tokens: usage?.total_tokens ?? null,
        });
        yield { type: 'done', conversation_id: conversation.id };
        return;
      }

      // assistant 工具调用消息落库（审计）
      await this.msgRepo.save({
        conversation_id: conversation.id,
        role: 'assistant',
        content: stepContent || null,
        tool_calls: calls,
        model: this.gateway.activeModel(),
        tokens: usage?.total_tokens ?? null,
      });

      // 逐个执行工具：以当前用户身份 + RBAC 校验，越权回填错误让模型改道
      messages.push({ role: 'assistant', content: stepContent || null, tool_calls: calls });
      for (const call of calls) {
        const argsPreview = call.function.arguments.slice(0, 200);
        yield { type: 'tool_call', name: call.function.name, args: argsPreview };
        const result = await this.executeToolSafe(userId, call.function.name, call.function.arguments);
        const resultText = JSON.stringify(result.full);
        yield { type: 'tool_result', name: call.function.name, ok: result.ok, summary: resultText.slice(0, 400) };
        this.logger.log(
          `agent tool=${call.function.name} ok=${result.ok} user=${userId} args=${argsPreview}`,
        );
        messages.push({ role: 'tool', tool_call_id: call.id, content: resultText.slice(0, 4000) });
      }
    }

    // 步数上限：给出明确终止说明（防无限循环）
    const capNote = '（已达单轮工具调用步数上限，请基于以上结果继续，或发起新指令。）';
    await this.msgRepo.save({
      conversation_id: conversation.id,
      role: 'assistant',
      content: capNote,
      model: this.gateway.activeModel(),
    });
    yield { type: 'delta', text: capNote };
    yield { type: 'done', conversation_id: conversation.id };
  }

  /** 工具执行安全壳：越权/参数错误统一转为错误结果回填（不中断循环） */
  private async executeToolSafe(
    userId: string,
    name: string,
    rawArgs: string,
  ): Promise<{ ok: boolean; full: Record<string, unknown> }> {
    const tool = this.toolMap.get(name);
    if (!tool) return { ok: false, full: { error: `未知工具: ${name}` } };
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(rawArgs || '{}');
    } catch {
      return { ok: false, full: { error: '工具参数不是合法 JSON' } };
    }
    try {
      const full = await tool.execute({ userId }, args);
      return { ok: true, full };
    } catch (err) {
      // 权限拒绝（Forbidden/NotFound）与其他业务错误统一作为工具结果
      const msg = (err as Error).message ?? '工具执行失败';
      return { ok: false, full: { error: msg } };
    }
  }
}
