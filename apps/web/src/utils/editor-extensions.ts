import { Extension, InputRule, nodeInputRule } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Markdown } from 'tiptap-markdown';

/**
 * StarterKit 之外的 Markdown 内容扩展（论文 5.3.2 Markdown 语法支持）。
 *
 * Tiptap 是插件化架构：StarterKit 只含标题/加粗/列表/引用/代码块等核心节点，
 * 图片与表格需注册官方扩展后，Markdown 语法才有对应 schema 节点
 * （tiptap-markdown 自带这两种节点的序列化器）。
 *
 * 本模块统一提供三层 Markdown 支持：
 * 1. schema 节点：Image / Table 系列（编辑器/只读视图/分享页/打印页四渲染面必须同组注册，
 *    否则 JSONB 快照里的节点会在缺扩展的渲染面被丢弃）
 * 2. 粘贴/复制转换：Markdown 扩展（transformPasted/CopiedText）——粘贴 Markdown 文本
 *    （整段表格、图片语法）解析为文档节点；复制出来的是 Markdown 文本
 * 3. 输入规则：图片语法由 extension-image 自带 input rule；
 *    表格无官方 input rule，自定义 MarkdownTableSyntax（表头行 + 分隔行后按 Enter 转换）
 */

/** 按管道拆分一行："| a | b |" → ["a", "b"] */
function splitRow(text: string): string[] {
  return text
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** 分隔行：| --- | :---: | —— 至少含一个 -，全部字符为 |、-、:、空白 */
function isSeparatorRow(text: string): boolean {
  const t = text.trim();
  return /^\|?[\s:|-]+\|?$/.test(t) && t.includes('|') && t.includes('-');
}

/** 表头行：含 | 但不是分隔行 */
function isHeaderRow(text: string): boolean {
  const t = text.trim();
  return t.includes('|') && !isSeparatorRow(t) && splitRow(t).length > 0;
}

/**
 * Markdown 管道表格输入规则：
 * 输入表头行（| a | b |）回车 → 输入分隔行（| --- | --- |）再回车 → 两行转换为 3 节点表格
 */
const MarkdownTableSyntax = Extension.create({
  name: 'markdownTableSyntax',

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;
        // 光标须在段落末尾（回车才触发转换，避免中途误触）
        if ($from.parent.type.name !== 'paragraph') return false;
        if ($from.parentOffset !== $from.parent.content.size) return false;
        const sepText = $from.parent.textContent;
        if (!isSeparatorRow(sepText)) return false;

        const index = $from.index(0);
        if (index === 0) return false;
        const prev = state.doc.child(index - 1);
        if (prev.type.name !== 'paragraph') return false;
        const headerText = prev.textContent;
        if (!isHeaderRow(headerText)) return false;

        const header = splitRow(headerText);
        const cols = splitRow(sepText).length;
        if (!cols || header.length !== cols) return false;

        // 替换范围：前一块起点 ~ 当前块终点
        const from = $from.before(1) - prev.nodeSize;
        const to = $from.after(1);
        const cell = (type: 'tableHeader' | 'tableCell', text?: string) => ({
          type,
          attrs: { colspan: 1, rowspan: 1, colwidth: null },
          content: text
            ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
            : [{ type: 'paragraph' }],
        });
        const tableJson = {
          type: 'table',
          content: [
            { type: 'tableRow', content: header.map((c) => cell('tableHeader', c || undefined)) },
            { type: 'tableRow', content: Array.from({ length: cols }, () => cell('tableCell')) },
          ],
        };
        // 光标送入表头第一格：table(from)→row(+1)→cell(+2)→paragraph(+3)→文字位(+4)
        void editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, tableJson)
          .setTextSelection(from + 4)
          .run();
        return true;
      },
    };
  },
});

export function markdownContentExtensions() {
  return [
    Image.configure({ inline: false, allowBase64: true }),
    // StarterKit 不含链接（Markdown 最核心语法之一）；autolink 自动识别裸 URL
    Link.configure({ openOnClick: false, autolink: true }),
    // GFM 任务列表：- [ ] / - [x]（task-item 自带输入规则）
    TaskList,
    TaskItem.configure({ nested: true }),
    // resizable 关闭：协作场景下列宽属 CRDT 属性同步，演示版保持简单
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    // Markdown 原生体验：粘贴 Markdown 文本解析为节点，复制导出为 Markdown 文本
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    // 图片语法输入规则（![alt](url) 回车后转换）由 extension-image 内置；
    // 此处显式再挂一个更宽松的规则兜底（URL 含中文/全角括号时内置正则 \S+ 可能失配）
    Extension.create({
      name: 'markdownImageSyntax',
      addInputRules() {
        return [
          nodeInputRule({
            find: /!\[([^\]]*)\]\(([^)]+)\)$/,
            type: this.editor.schema.nodes.image,
            getAttributes: (match) => ({ src: match[2].trim(), alt: match[1] || null }),
          }),
        ];
      },
    }),
    // 链接语法输入规则：[text](url) —— 用 text + link mark 替换整个匹配（link 扩展不自带此规则）
    Extension.create({
      name: 'markdownLinkSyntax',
      addInputRules() {
        return [
          new InputRule({
            find: /\[([^\]]+)\]\(([^)]+)\)$/,
            handler: ({ range, match, chain }) => {
              const [, text, url] = match;
              chain()
                .insertContentAt({ from: range.from, to: range.to }, [
                  {
                    type: 'text',
                    text,
                    marks: [{ type: 'link', attrs: { href: url.trim() } }],
                  },
                ])
                .run();
              return null;
            },
          }),
        ];
      },
    }),
    MarkdownTableSyntax,
  ];
}
