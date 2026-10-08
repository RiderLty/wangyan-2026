/**
 * 服务端 Markdown → ProseMirror 文档 JSON 转换（论文 5.10.3 Agent 工具 create_note/update_note 用）。
 *
 * 说明：Agent 生成的笔记正文是 Markdown 文本，而 notes.content 存 ProseMirror JSON（D-007）。
 * 服务端不引入完整 markdown-it/tiptap（避免与前端渲染面双口径），本转换器覆盖
 * Agent 写作常用子集：标题、无序/有序列表、引用、围栏代码块、管道表格、分隔线、
 * 行内加粗/斜体/行内代码标记。嵌套列表等复杂结构不支持（平铺处理），见 CHANGELOG 诚实记录。
 * 与前端 tiptap-markdown 的渲染面共用同一 schema 节点名（5.3.2 五渲染面同组注册原则）。
 */

import { prosemirrorToPlainText } from '../../notes/prosemirror.util';

type PmNode = Record<string, unknown>;

/** 行内标记解析：**bold** / *italic* / `code` → 带 marks 的 text 节点序列 */
export function parseInline(text: string): PmNode[] {
  const nodes: PmNode[] = [];
  // 交替正则：行内代码优先（内部不解析其他标记），其次加粗/斜体
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) nodes.push({ type: 'text', text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith('`')) {
      nodes.push({ type: 'text', marks: [{ type: 'code' }], text: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      nodes.push({ type: 'text', marks: [{ type: 'bold' }], text: token.slice(2, -2) });
    } else {
      nodes.push({ type: 'text', marks: [{ type: 'italic' }], text: token.slice(1, -1) });
    }
    last = m.index! + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes.length ? nodes : [{ type: 'text', text }];
}

const paragraph = (text: string): PmNode => ({ type: 'paragraph', content: parseInline(text) });
const heading = (level: number, text: string): PmNode => ({
  type: 'heading',
  attrs: { level, textAlign: null },
  content: parseInline(text),
});

/** 管道表格行拆分（与前端 markdownTableSyntax 同口径：| a | b | → [a,b]） */
function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}
const isTableSeparator = (line: string) =>
  /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes('|') && line.includes('-');

const cell = (type: 'tableHeader' | 'tableCell', text: string): PmNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [paragraph(text)],
});

/** 主入口：Markdown 文本 → ProseMirror doc JSON */
export function markdownToProsemirror(md: string): PmNode {
  const content: PmNode[] = [];
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let listType: 'bulletList' | 'orderedList' | null = null;
  let listItems: PmNode[] = [];

  const flushList = () => {
    if (listType && listItems.length) content.push({ type: listType, content: listItems });
    listType = null;
    listItems = [];
  };
  const pushListItem = (text: string) => ({ type: 'listItem', content: [paragraph(text)] });

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    if (line.trimStart().startsWith('```')) {
      flushList();
      const lang = line.trim().slice(3).trim() || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) buf.push(lines[i++]);
      i++; // 跳过收尾 ```
      content.push({ type: 'codeBlock', attrs: { language: lang }, content: [{ type: 'text', text: buf.join('\n') }] });
      continue;
    }

    // 管道表格：表头行 + 分隔行 + 数据行
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushList();
      const header = splitTableRow(line);
      i += 2;
      const rows: PmNode[] = [
        { type: 'tableRow', content: header.map((c) => cell('tableHeader', c)) },
      ];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        const cols = splitTableRow(lines[i]);
        rows.push({
          type: 'tableRow',
          content: header.map((_, idx) => cell('tableCell', cols[idx] ?? '')),
        });
        i++;
      }
      content.push({ type: 'table', content: rows });
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      content.push(heading(h[1].length, h[2].trim()));
      i++;
      continue;
    }

    // 无序/有序列表（连续行归并；不支持嵌套，平铺处理）
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.、)]\s+(.*)$/);
    if (ul || ol) {
      const want: 'bulletList' | 'orderedList' = ul ? 'bulletList' : 'orderedList';
      if (listType && listType !== want) flushList();
      listType = want;
      listItems.push(pushListItem((ul ?? ol)![1]));
      i++;
      continue;
    }

    // 引用
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushList();
      content.push({ type: 'blockquote', content: [paragraph(quote[1])] });
      i++;
      continue;
    }

    // 分隔线
    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushList();
      content.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    flushList();
    if (line.trim()) content.push(paragraph(line.trim()));
    i++;
  }
  flushList();
  return { type: 'doc', content };
}

// 自检：转换结果必须能被 prosemirrorToPlainText 逆处理（保证 notes.content_text 派生列兼容）
export function markdownToNoteContent(md: string): { content: PmNode; content_text: string } {
  const content = markdownToProsemirror(md);
  return { content, content_text: prosemirrorToPlainText(content) };
}
