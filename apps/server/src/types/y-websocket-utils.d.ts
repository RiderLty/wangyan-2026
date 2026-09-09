/**
 * y-websocket 的服务端工具（bin/utils）只提供 CJS 实现无类型声明，
 * 这里按其 utils.cjs 实际导出手写最小声明。
 */
declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type { WebSocket } from 'ws';
  import type { Doc } from 'yjs';

  export interface WSPersistence {
    bindState(docName: string, ydoc: Doc): void | Promise<void>;
    writeState(docName: string, ydoc: Doc): void | Promise<unknown>;
  }

  export function setPersistence(persistence: WSPersistence): void;
  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: { docName?: string; gc?: boolean },
  ): void;
  export const docs: Map<string, Doc>;
}
