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

/**
 * 调用编辑器 AI 流式接口。返回的 Promise 在流结束时 resolve；
 * 中断用 AbortSignal（Esc 停止按钮）。
 */
export async function streamEditorAi(
  payload: EditorAiPayload,
  handlers: EditorAiHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch('/api/ai/editor/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    handlers.onError('网络错误，无法连接 AI 服务');
    return;
  }

  if (!res.ok) {
    // 建流前的错误（权限/参数/未配置）是常规 JSON 响应
    let message = `AI 服务错误（${res.status}）`;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) message = Array.isArray(data.message) ? data.message.join('；') : data.message;
    } catch {
      /* 保留默认文案 */
    }
    handlers.onError(message);
    return;
  }
  if (!res.body) {
    handlers.onError('AI 服务未返回数据流');
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
      // SSE 以空行分帧
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
          handlers.onDone();
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }
        if (event === 'delta') handlers.onDelta((parsed as { text: string }).text);
        else if (event === 'error') handlers.onError((parsed as { message: string }).message);
        else if (event === 'done') {
          sawDone = true;
          handlers.onDone();
          return;
        }
      }
    }
    if (!sawDone) handlers.onError('AI 响应流意外中断');
  } catch (err) {
    if ((err as Error).name === 'AbortError') return; // 用户主动停止
    handlers.onError('AI 响应流读取失败');
  } finally {
    reader.releaseLock();
  }
}
