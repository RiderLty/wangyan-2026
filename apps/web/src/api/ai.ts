import { TOKEN_KEY } from './client';

/**
 * AI 接口客户端（论文 5.10.2，v2.0 计划 L1）
 *
 * 编辑器 AI 走 POST + SSE：指令/选区文本需 POST body 传递，EventSource 只支持 GET，
 * 因此用 fetch + ReadableStream 手工解析 text/event-stream 帧。
 */

export type EditorAiAction = 'continue' | 'polish' | 'summarize' | 'translate' | 'custom';

export interface EditorAiPayload {
  action: EditorAiAction;
  note_id?: string;
  /** 选区文本或光标前文 */
  text?: string;
  /** 自定义指令（action=custom） */
  instruction?: string;
}

/** SSE 流式回调：delta 正文增量（reasoning 已在服务端丢弃，D-015） */
export interface EditorAiHandlers {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** 调用编辑器 AI 流式接口。返回的 Promise 在流结束时 resolve；中断用 AbortSignal（Esc 停止按钮）。 */
export async function streamEditorAi(
  payload: EditorAiPayload,
  handlers: EditorAiHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const dispatch = (event: string, data: Record<string, unknown>) => {
    if (event === 'delta') handlers.onDelta(data.text as string);
    else if (event === 'error') handlers.onError(data.message as string);
    else if (event === 'done') handlers.onDone();
  };
  const res = await openAiStream('/api/ai/editor/actions', payload, dispatch, signal);
  if (!res) return;
  await consumeSse(res, dispatch);
}

// ---- L4 Agent 对话（论文 5.10.3）----

export interface AgentHandlers {
  /** 会话保障：新建会话时返回新 conversation_id，后续轮次带回 */
  onMeta: (conversationId: string) => void;
  onDelta: (text: string) => void;
  onToolCall: (name: string, args: string) => void;
  onToolResult: (name: string, ok: boolean, summary: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

/** 调用 Agent 对话流式接口（工具调用以当前用户身份执行并受 RBAC 约束） */
export async function streamAgentChat(
  payload: { conversation_id?: string; note_id?: string; message: string },
  handlers: AgentHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const dispatch = (event: string, data: Record<string, unknown>) => {
    if (event === 'meta') handlers.onMeta(data.conversation_id as string);
    else if (event === 'delta') handlers.onDelta(data.text as string);
    else if (event === 'tool_call') handlers.onToolCall(data.name as string, (data.args as string) ?? '');
    else if (event === 'tool_result')
      handlers.onToolResult(data.name as string, data.ok as boolean, (data.summary as string) ?? '');
    else if (event === 'done') handlers.onDone();
    else if (event === 'error') handlers.onError(data.message as string);
  };
  const res = await openAiStream('/api/ai/agent/chat', payload, dispatch, signal);
  if (!res) return;
  await consumeSse(res, dispatch);
}

/** 通用 SSE 帧消费：返回是否正常终止（[DONE]），错误经 onEvent('error', …) 上抛 */
async function consumeSse(
  res: Response,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  if (!res.body) {
    onEvent('error', { message: 'AI 服务未返回数据流' });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let sawDone = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        let event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trimStart();
        }
        if (data === '[DONE]') {
          sawDone = true;
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        onEvent(event, parsed as Record<string, unknown>);
      }
    }
    if (!sawDone) onEvent('error', { message: 'AI 响应流意外中断' });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') onEvent('error', { message: 'AI 响应流读取失败' });
  } finally {
    reader.releaseLock();
  }
}

/** 建流的公共前置：POST + 错误响应解析；失败时调用 onEvent('error') */
async function openAiStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<Response | null> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') onEvent('error', { message: '网络错误，无法连接 AI 服务' });
    return null;
  }
  if (!res.ok) {
    let message = `AI 服务错误（${res.status}）`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) message = Array.isArray(data.message) ? data.message.join('；') : data.message;
    } catch {
      /* 保留默认文案 */
    }
    onEvent('error', { message });
    return null;
  }
  return res;
}
