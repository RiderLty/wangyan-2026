import {
  Body,
  Controller,
  ForbiddenException,
  Logger,
  Post,
  Request,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotesService } from '../../notes/notes.service';
import { LlmGatewayService } from '../llm/llm-gateway.service';
import { LlmError } from '../llm/llm.types';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';

/**
 * 编辑器 AI 接口（论文 5.10.2 编辑器 AI 与 CRDT 集成，v2.0 计划 L1）
 *
 * 设计：SSE 流式（POST + text/event-stream，前端用 fetch 流式读取而非 EventSource——
 * 指令/选区文本需要 POST body 传递）。AI 输出不在服务端写文档：
 * 前端把流式文本经 Tiptap 命令写入编辑器，而编辑器由 Yjs 驱动，
 * 因此 AI 的每次插入与人类编辑走同一条 CRDT 增量同步链路（多端可见、可撤销）。
 *
 * 权限：复用笔记级四级访问矩阵（getAccessLevel）——team_read 只读成员
 * 不允许 AI 写入类操作（AI 是"协作者"而非旁路，写入与人工编辑同权校验）。
 */

/** 编辑器 AI 动作（v2.0 计划 L1） */
export const EDITOR_AI_ACTIONS = ['continue', 'polish', 'summarize', 'translate', 'custom'] as const;
export type EditorAiAction = (typeof EDITOR_AI_ACTIONS)[number];

class EditorAiDto {
  @IsIn(EDITOR_AI_ACTIONS)
  action!: EditorAiAction;

  /** 目标笔记：用于权限校验与取全文（summarize 必传） */
  @IsOptional()
  @IsString()
  note_id?: string;

  /** 操作对象文本：选区内容（polish/translate/custom）或光标前文（continue） */
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  /** 自定义指令（custom 必传） */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instruction?: string;
}

/** 各动作的系统提示词（集中定义便于论文摘录与后续调优） */
const SYSTEM_PROMPTS: Record<EditorAiAction, string> = {
  continue:
    '你是笔记编辑器里的续写助手。根据用户给出的笔记前文，自然地继续写作。只输出续写的内容，不要重复前文，不要解释。保持与前文一致的语言、语气和 Markdown 风格。',
  polish:
    '你是中文润色助手。改写用户给出的文本，使其更通顺、准确、简洁，保留原意与 Markdown 格式（若有）。只输出改写后的文本，不要解释。',
  summarize:
    '你是笔记摘要助手。为用户的笔记写一段简明摘要，突出核心要点，控制在 150 字以内，使用简体中文输出纯文本。',
  translate:
    '你是翻译助手。用户给出中文则翻译为英文，给出英文则翻译为中文；保留 Markdown 格式（若有）。只输出译文，不要解释。',
  custom:
    '你是笔记编辑器里的写作助手。按用户指令处理给出的文本或撰写内容。只输出结果本身，不要解释。',
};

@Controller('ai/editor')
@UseGuards(JwtAuthGuard)
export class EditorAiController {
  private readonly logger = new Logger(EditorAiController.name);

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly notesService: NotesService,
  ) {}

  /**
   * POST /api/ai/editor/actions —— 编辑器 AI 流式接口（SSE）
   * 事件：event: delta {text} 正文增量 / event: done {usage} / event: error {message} / data: [DONE]
   */
  @Post('actions')
  async run(
    @Request() req: { user: { id: string } },
    @Body() dto: EditorAiDto,
    @Res() res: Response,
  ) {
    if (!this.gateway.isConfigured()) {
      throw new ServiceUnavailableException('AI 服务未配置（服务端缺少 AI_API_KEY），请联系管理员');
    }

    // 参数与权限校验（发生在建流之前，前端能收到常规 HTTP 错误响应）
    let contextText = dto.text ?? '';
    if (dto.action === 'custom' && !dto.instruction?.trim()) {
      throw new ForbiddenException('自定义指令不能为空');
    }
    if (dto.action === 'summarize') {
      if (!dto.note_id) throw new ForbiddenException('摘要需要指定笔记');
      // 摘要操作对象是全文，但结果是"插入"而非改写：read 级成员也允许（与查看版本同级）
      const { note } = await this.notesService.getAccessLevel(req.user.id, dto.note_id);
      contextText = note.title ? `《${note.title}》\n\n${note.content_text ?? ''}` : (note.content_text ?? '');
    } else if (dto.note_id) {
      // 写入类动作（continue/polish/translate/custom 作用于笔记）：等同一次人工编辑，需可写权限
      await this.assertWritable(dto.note_id, req.user.id);
    }
    if (dto.action !== 'summarize' && !contextText.trim() && dto.action !== 'custom') {
      throw new ForbiddenException('缺少操作文本（请先选中文字或将光标放在要续写的位置）');
    }

    // ---- 建立 SSE 通道 ----
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // NAS 部署经 nginx 反代：关闭其缓冲，否则流式事件会被攒满 buffer 才下发
      'X-Accel-Buffering': 'no',
    });

    const model = this.gateway.activeModel(true);
    const messages = this.buildMessages(dto.action, contextText, dto.instruction);
    const started = Date.now();
    let chars = 0;
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      for await (const ev of this.gateway.streamChat(messages, {
        model,
        temperature: dto.action === 'polish' ? 0.4 : 0.7,
        maxTokens: 2048,
      })) {
        if (ev.type === 'delta') {
          chars += ev.text.length;
          send('delta', { text: ev.text });
        } else if (ev.type === 'reasoning') {
          // 思维链不进正文（D-015）；编辑器场景直接丢弃，避免干扰写作
        } else if (ev.type === 'usage') {
          this.logger.log(
            `editor-ai action=${dto.action} model=${model} chars=${chars} ` +
              `${Date.now() - started}ms tokens=${ev.usage.total_tokens ?? '?'}` +
              `${ev.usage.prompt_cache_hit_tokens ? ` cache_hit=${ev.usage.prompt_cache_hit_tokens}` : ''}`,
          );
          send('done', { usage: ev.usage });
        }
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof LlmError ? err.message : 'AI 服务异常，请稍后重试';
      send('error', { message });
    } finally {
      res.end();
    }
  }

  /** 笔记可写校验：owner/team_admin/team_edit 可用 AI 写入，team_read 拒绝（4.5.2 矩阵复用） */
  private async assertWritable(noteId: string, userId: string) {
    const { level } = await this.notesService.getAccessLevel(userId, noteId);
    if (level === 'team_read') throw new ForbiddenException('团队只读笔记不可使用 AI 编辑');
  }

  private buildMessages(action: EditorAiAction, text: string, instruction?: string) {
    const system = SYSTEM_PROMPTS[action];
    let user: string;
    switch (action) {
      case 'continue':
        user = `以下是笔记的前文，请接着往下写：\n\n${text}`;
        break;
      case 'custom':
        user = text ? `指令：${instruction}\n\n文本：\n${text}` : `指令：${instruction}`;
        break;
      default:
        user = text;
    }
    return [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ];
  }
}
