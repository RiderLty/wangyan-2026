import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Spin } from 'antd';
import { useParams } from 'react-router-dom';
import { getNote } from '../api/notes';
import type { NoteDetail } from '../api/notes';
import { markdownContentExtensions } from '../utils/editor-extensions';

/**
 * PDF 打印视图（论文 5.8.1 导出为 PDF）
 *
 * 前端导出方案（D-012）：干净排版（无侧栏/工具栏）+ 加载完成后自动调起
 * window.print()，由浏览器"另存为 PDF"完成导出——免服务端无头浏览器依赖，
 * 打印样式与分页交给浏览器排版引擎。
 */
export default function PrintPage() {
  const { noteId = '' } = useParams();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getNote(noteId)
      .then((detail) => {
        setNote(detail);
        // 等待渲染一帧后调起打印
        requestAnimationFrame(() => window.print());
      })
      .catch(() => setFailed(true));
  }, [noteId]);

  if (failed) {
    return <div style={{ padding: 40, textAlign: 'center' }}>笔记不存在或无权访问</div>;
  }
  if (!note) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="正在准备打印视图…" />
      </div>
    );
  }
  return <PrintableNote key={note.id} note={note} />;
}

function PrintableNote({ note }: { note: NoteDetail }) {
  const editor = useEditor({
    extensions: [StarterKit, ...markdownContentExtensions()],
    content: note.content as never,
    editable: false,
  });

  return (
    <div className="print-page">
      <h1 className="print-title">{note.title}</h1>
      <div className="print-meta">
        导出自 在线Markdown笔记编辑与管理平台 · {new Date().toLocaleString('zh-CN')}
      </div>
      <EditorContent editor={editor} className="print-content" />
    </div>
  );
}
