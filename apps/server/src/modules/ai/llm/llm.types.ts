/**
 * LLM 网关类型定义（论文 5.10.1 AI 网关，v2.0 计划 6.3.1）
 *
 * 统一 OpenAI Chat Completions 兼容协议的消息/工具/流式事件类型。
 * 网关是全系统唯一出网口：对话通道默认 DeepSeek（AI_BASE_URL），
 * 向量通道独立配置（AI_EMBEDDINGS_BASE_URL，DeepSeek 无 embeddings 端点故分离）。
 */

/** 对话消息（兼容 OpenAI role/content 体系，含工具调用回填） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** tool 角色消息 content 为工具执行结果字符串 */
  content: string | null;
  /** assistant 消息携带的发起调用（回填对话历史时使用） */
  tool_calls?: ToolCall[];
  /** tool 消息对应的调用 id */
  tool_call_id?: string;
}

/** 一次工具调用（流式分片聚合后的完整形态） */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** 注册给模型的工具定义（Function Calling，L4 Agent 使用） */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** 用量统计（DeepSeek 特有字段：缓存命中/思考 tokens，入库供审计页展示） */
export interface LlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens_details?: { reasoning_tokens?: number };
}

/**
 * 流式事件（网关解析 SSE 后的统一形态，屏蔽厂商差异）：
 * - reasoning：思考模型的思维链增量（reasoning_content），不进正文
 * - delta：最终答案文本增量
 * - tool_calls：流式分片聚合完成的完整工具调用数组（一次流最多一批）
 * - usage：token 用量（流结束前的最后一个 chunk 携带）
 * - error：上游错误（已终止流）
 */
export type LlmStreamEvent =
  | { type: 'reasoning'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'usage'; usage: LlmUsage }
  | { type: 'error'; message: string };

/** 网关层错误：带 HTTP 状态，供上层区分 401（配置错）/429（限流）/其他 */
export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
