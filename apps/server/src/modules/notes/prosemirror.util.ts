/**
 * ProseMirror 文档 JSON → 纯文本（database-design.md 反规范化 R1）
 *
 * notes.content 存 Tiptap(ProseMirror) 的文档 JSON，content_text 由本函数
 * 在保存时派生，作为 5.3.4 全文检索的载体。遍历收集所有 text 节点。
 */
export function prosemirrorToPlainText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { text?: unknown; content?: unknown };
    if (typeof n.text === 'string') {
      parts.push(n.text);
      return;
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  };
  walk(doc);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
