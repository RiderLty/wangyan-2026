import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import type { NoteDetail } from '../api/notes';

/**
 * 笔记导出工具（论文 5.8.1 导出为 PDF / 5.8.2 导出为 Markdown）
 *
 * 方案（D-012，用户指定前端实现）：
 * - Markdown：tiptap-markdown 扩展把 ProseMirror JSON 反序列化为 Markdown 文本
 *   （与编辑器同一套 schema，保证导出与所见内容一致），Blob 下载
 * - PDF：跳转专用打印视图（/print/:noteId，干净排版 + 自动调起系统打印，
 *   浏览器"另存为 PDF"完成导出，免服务端无头浏览器依赖）
 */

/** 文件名安全化：去除路径分隔符等非法字符 */
function safeFileName(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, '_').trim() || '未命名笔记';
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** 把 ProseMirror JSON 序列化为 Markdown（headless Editor 实例，不挂载 DOM） */
export function noteToMarkdown(content: Record<string, unknown>): string {
  const editor = new Editor({
    extensions: [StarterKit, Markdown.configure({ html: false })],
    content: content as never,
  });
  const markdown = (editor.storage as { markdown: { getMarkdown: () => string } })
    .markdown.getMarkdown();
  editor.destroy();
  return markdown;
}

/** 导出为 .md 文件（论文 5.8.2） */
export function exportMarkdown(note: Pick<NoteDetail, 'title' | 'content'>): string {
  const markdown = noteToMarkdown(note.content);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const fileName = `${safeFileName(note.title)}.md`;
  downloadBlob(blob, fileName);
  return markdown;
}

/** 打开 PDF 打印视图（论文 5.8.1；打印页加载后自动调起系统打印） */
export function openPrintView(noteId: string): void {
  window.open(`/print/${noteId}`, '_blank');
}
