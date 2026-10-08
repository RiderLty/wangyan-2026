import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChatMessage,
  LlmError,
  LlmStreamEvent,
  LlmUsage,
  ToolCall,
  ToolDefinition,
} from './llm.types';

/**
 * LLM 网关（论文 5.10.1，v2.0 计划 6.3.2）——全系统唯一 LLM 出网口。
 *
 * 设计要点（D-015）：
 * - 服务端全托管：端点/Key/模型全部来自服务端 .env，前端零配置、永不直连模型
 * - 双通道：对话（AI_BASE_URL，默认 DeepSeek）与向量（AI_EMBEDDINGS_*，可选）分离——
 *   DeepSeek 官方 API 无 /v1/embeddings，向量通道指向任意 OpenAI 兼容 embeddings 服务
 *   （默认规划：阿里百炼 qwen3.7-text-embedding）；未配置则向量能力整体不可用
 * - DeepSeek 特有处理：reasoning_content（思维链）作为独立事件透传、不混入正文；
 *   tool_calls 流式分片在此聚合为完整调用再交给上层（agent loop 不感知分片）；
 *   usage 的 prompt_cache_hit_tokens / reasoning_tokens 原样透传入库
 * - 错误分级：401 直报（配置错）、429 指数退避重试一次、其余原样上抛
 */

@Injectable()
export class LlmGatewayService implements OnModuleInit {
  private readonly logger = new Logger(LlmGatewayService.name);
  /** 对话通道 */
  private baseUrl = '';
  private apiKey = '';
  private defaultModel = 'deepseek-flash';
  /** 编辑器/低延迟场景优先使用的快速模型（未配置则回落 defaultModel） */
  private fastModel = '';
  /** 向量通道（可选，未配置则 embed 抛错、L3 功能降级隐藏） */
  private embeddingsBaseUrl = '';
  private embeddingsApiKey = '';
  private embeddingsModel = '';

  constructor(private readonly config: ConfigService) {}

  /** 启动时打印配置状态（不打印 Key），部署后一眼可查 AI 是否可用 */
  onModuleInit() {
    this.reloadConfig();
    this.logger.log(
      `对话通道: ${this.isConfigured() ? `${this.baseUrl} (model=${this.defaultModel})` : '未配置 AI_API_KEY，AI 功能关闭'}` +
        ` | 向量通道: ${this.isEmbeddingsConfigured() ? `${this.embeddingsBaseUrl} (model=${this.embeddingsModel})` : '未配置（L3 语义检索降级隐藏）'}`,
    );
  }

  reloadConfig() {
    this.baseUrl = this.config.get('AI_BASE_URL', 'https://api.deepseek.com/v1').replace(/\/$/, '');
    this.apiKey = this.config.get('AI_API_KEY', '');
    this.defaultModel = this.config.get('AI_MODEL', 'deepseek-flash');
    this.fastModel = this.config.get('AI_MODEL_FAST', '');
    this.embeddingsBaseUrl = this.config.get('AI_EMBEDDINGS_BASE_URL', '').replace(/\/$/, '');
    this.embeddingsApiKey = this.config.get('AI_EMBEDDINGS_API_KEY', this.apiKey);
    this.embeddingsModel = this.config.get('AI_EMBEDDINGS_MODEL', '');
  }

  /** 对话通道是否已配置（未配置时上层接口统一返回 503，前端提示） */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /** 向量通道是否已配置（决定 L3 混合检索是否启用） */
  isEmbeddingsConfigured(): boolean {
    return !!(this.embeddingsBaseUrl && this.embeddingsApiKey && this.embeddingsModel);
  }

  /** 当前生效模型名（供接口层回显给前端展示） */
  activeModel(preferFast = false): string {
    return (preferFast && this.fastModel) || this.defaultModel;
  }

  /**
   * 流式对话：把上游 SSE 转换为统一事件流。
   * 429 退避重试一次（仅限流未建立连接前）；请求体 tools 透传（L4 Agent）。
   */
  async *streamChat(
    messages: ChatMessage[],
    opts: {
      model?: string;
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      signal?: AbortSignal;
    } = {},
  ): AsyncGenerator<LlmStreamEvent> {
    if (!this.isConfigured()) {
      throw new LlmError('AI 服务未配置（服务端缺少 AI_API_KEY），请联系管理员', 503);
    }
    const body = {
      model: opts.model ?? this.defaultModel,
      messages,
      stream: true,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
    };
    let res: Response;
    try {
      res = await this.requestWithRetry(body, opts.signal);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      if (err instanceof LlmError) throw err;
      throw new LlmError(`无法连接 AI 服务: ${(err as Error).message}`);
    }
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new LlmError(
        `AI 服务返回 ${res.status}: ${text.slice(0, 300) || res.statusText}`,
        res.status,
      );
    }

    // ---- SSE 逐帧解析（DeepSeek/OpenAI 均为标准 data: JSON 帧）----
    const toolAcc = new Map<number, { id: string; name: string; arguments: string }>();
    try {
      for await (const payload of this.sseDataPayloads(res.body)) {
        if (payload === '[DONE]') break;
        let chunk: {
          choices?: Array<{
            delta?: {
              content?: string | null;
              reasoning_content?: string | null;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
          usage?: LlmUsage;
        };
        try {
          chunk = JSON.parse(payload);
        } catch {
          continue; // 跳过无法解析的残帧
        }
        const choice = chunk.choices?.[0];
        if (choice?.delta?.reasoning_content) {
          yield { type: 'reasoning', text: choice.delta.reasoning_content };
        }
        if (choice?.delta?.content) {
          yield { type: 'delta', text: choice.delta.content };
        }
        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index ?? 0;
            const acc = toolAcc.get(idx) ?? { id: '', name: '', arguments: '' };
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
            toolAcc.set(idx, acc);
          }
        }
        // finish_reason=tool_calls 或流自然结束时，聚合结果一次性交给上层
        if (choice?.finish_reason === 'tool_calls' && toolAcc.size > 0) {
          yield { type: 'tool_calls', calls: this.mergeToolCalls(toolAcc) };
          toolAcc.clear();
        }
        if (chunk.usage) {
          yield { type: 'usage', usage: chunk.usage };
        }
      }
      // 兜底：部分兼容端点不发 finish_reason 直接结束
      if (toolAcc.size > 0) {
        yield { type: 'tool_calls', calls: this.mergeToolCalls(toolAcc) };
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        yield { type: 'error', message: `AI 流式响应中断: ${(err as Error).message}` };
      }
    }
  }

  /** 非流式对话便捷封装（摘要/标签等后台任务用），返回全文与用量 */
  async chat(
    messages: ChatMessage[],
    opts: { model?: string; temperature?: number; maxTokens?: number } = {},
  ): Promise<{ text: string; reasoning: string; usage?: LlmUsage }> {
    let text = '';
    let reasoning = '';
    let usage: LlmUsage | undefined;
    for await (const ev of this.streamChat(messages, opts)) {
      if (ev.type === 'delta') text += ev.text;
      else if (ev.type === 'reasoning') reasoning += ev.text;
      else if (ev.type === 'usage') usage = ev.usage;
      else if (ev.type === 'error') throw new LlmError(ev.message);
    }
    return { text, reasoning, usage };
  }

  /** 向量通道：批量文本向量化（OpenAI /v1/embeddings 兼容格式），L3 混合检索用 */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isEmbeddingsConfigured()) {
      throw new LlmError('向量通道未配置（AI_EMBEDDINGS_*），语义检索不可用', 503);
    }
    const res = await fetch(`${this.embeddingsBaseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.embeddingsApiKey}`,
      },
      body: JSON.stringify({ model: this.embeddingsModel, input: texts }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new LlmError(`向量服务返回 ${res.status}: ${text.slice(0, 300)}`, res.status);
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
    // 按 index 还原顺序（OpenAI 协议允许乱序返回）
    const out: number[][] = new Array(texts.length);
    for (const d of json.data) out[d.index] = d.embedding;
    return out;
  }

  // ---- 内部工具 ----

  /** 上游请求：429/5xx 指数退避重试一次（未建流之前，安全重试窗口） */
  private async requestWithRetry(body: unknown, signal?: AbortSignal): Promise<Response> {
    let lastErr: LlmError | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      if (res.ok) return res;
      lastErr = new LlmError(
        `AI 服务返回 ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`,
        res.status,
      );
      // 401/403 是配置错误重试无意义；仅限流/服务端错误退避后重试
      if (res.status !== 429 && res.status < 500) throw lastErr;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    throw lastErr;
  }

  /**
   * 逐帧读取上游 SSE 字节流，产出每个帧的 data 载荷字符串。
   * Node fetch 的 body 是 Web ReadableStream：解码 → 按行拆分 → 空行分帧；
   * data 行可多行（协议允许），同帧用 \n 连接；注释行（: keep-alive）忽略。
   */
  private async *sseDataPayloads(
    stream: ReadableStream<Uint8Array>,
  ): AsyncGenerator<string> {
    const decoder = new TextDecoder();
    let lineBuf = '';
    let dataLines: string[] = [];
    for await (const chunk of stream) {
      lineBuf += decoder.decode(chunk, { stream: true });
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '');
        if (trimmed === '') {
          // 空行 = 帧结束
          if (dataLines.length) {
            yield dataLines.join('\n');
            dataLines = [];
          }
          continue;
        }
        if (trimmed.startsWith('data:')) {
          dataLines.push(trimmed.slice(5).trimStart());
        }
      }
    }
    if (dataLines.length) yield dataLines.join('\n');
  }

  /** 分片聚合结果 → 完整 ToolCall 数组（按 index 排序保证确定性） */
  private mergeToolCalls(acc: Map<number, { id: string; name: string; arguments: string }>): ToolCall[] {
    return [...acc.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, v]) => ({
        id: v.id,
        type: 'function' as const,
        function: { name: v.name, arguments: v.arguments || '{}' },
      }));
  }
}
