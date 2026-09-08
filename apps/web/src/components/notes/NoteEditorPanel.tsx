import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Divider, Empty, Input, Select, Space, Tag, Tooltip, Typography } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  UndoOutlined,
  RedoOutlined,
  LoadingOutlined,
  CheckOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { NoteDetail, NoteTagInfo, TagInfo } from '../../api/notes';

/**
 * Tiptap 编辑器面板（论文 5.3.1 创建与编辑 / 5.3.2 实时预览）
 *
 * 实时预览说明（D-001 选型依据）：Tiptap 基于 ProseMirror，输入 Markdown 语法
 * （如 "# " "## " "- " "> "）由 input rules 即时转换为渲染后的富文本，
 * 即"所写即所见"的实时预览；正文以 ProseMirror JSON 存 PostgreSQL JSONB。
 */

const toolbarBtn = { paddingInline: 8, paddingInlineEnd: 8 };

/** 保存状态指示（自动保存：800ms 防抖，论文 5.3.1） */
function SaveStatus({ status }: { status: 'saved' | 'pending' | 'saving' | 'error' }) {
  if (status === 'saving')
    return (
      <span className="save-status">
        <LoadingOutlined /> 保存中…
      </span>
    );
  if (status === 'pending')
    return (
      <span className="save-status save-status-dirty">
        <EditOutlined /> 有未保存修改
      </span>
    );
  if (status === 'error')
    return (
      <span className="save-status save-status-error">保存失败，请重试</span>
    );
  return (
    <span className="save-status">
      <CheckOutlined /> 已保存
    </span>
  );
}

export interface NoteEditorPanelProps {
  note: NoteDetail | null;
  noteTags: NoteTagInfo[];
  allTags: TagInfo[];
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
  onTitleChange: (title: string) => void;
  onContentChange: (json: Record<string, unknown>) => void;
  onAttachTag: (tagId: string) => void;
  onDetachTag: (tagId: string) => void;
}

export default function NoteEditorPanel({
  note,
  noteTags,
  allTags,
  saveStatus,
  onTitleChange,
  onContentChange,
  onAttachTag,
  onDetachTag,
}: NoteEditorPanelProps) {
  const [title, setTitle] = useState('');

  // 切换笔记时同步标题（正文由 key 重挂载编辑器处理）
  useEffect(() => {
    setTitle(note?.title ?? '');
  }, [note?.id, note?.title]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '开始写点什么…（输入 # 、- 、> 等Markdown语法试试）' }),
    ],
    content: note?.content ?? { type: 'doc', content: [] },
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getJSON() as Record<string, unknown>);
    },
  });

  // note 切换后重设编辑器内容（由父组件 key 重挂载，这里兜底）
  useEffect(() => {
    if (editor && note) {
      const current = JSON.stringify(editor.getJSON());
      if (current !== JSON.stringify(note.content)) {
        editor.commands.setContent(note.content as never, false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  if (!note || !editor) {
    return (
      <div className="editor-panel editor-empty">
        <Empty description="选择左侧笔记，或新建一篇开始编辑" />
      </div>
    );
  }

  const attachableTags = allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id));

  return (
    <div className="editor-panel">
      {/* 笔记标题 + 保存状态 */}
      <div className="editor-header">
        <Input
          variant="borderless"
          size="large"
          value={title}
          placeholder="未命名笔记"
          maxLength={200}
          onChange={(e) => {
            setTitle(e.target.value);
            onTitleChange(e.target.value);
          }}
        />
        <SaveStatus status={saveStatus} />
      </div>

      {/* 标签行 */}
      <div className="editor-tags">
        <Space size={4} wrap>
          {noteTags.map((t) => (
            <Tag
              key={t.id}
              color={t.color ?? 'default'}
              closable
              onClose={(e) => {
                e.preventDefault();
                onDetachTag(t.id);
              }}
            >
              {t.name}
            </Tag>
          ))}
          <Select
            size="small"
            variant="borderless"
            placeholder="+ 标签"
            style={{ minWidth: 72 }}
            value={null}
            options={attachableTags.map((t) => ({ value: t.id, label: t.name }))}
            onSelect={(value: string | null) => {
              if (value) onAttachTag(value);
            }}
          />
        </Space>
      </div>

      {/* 工具栏（5.3.2：Markdown 语法即时渲染，工具栏提供等价按钮） */}
      <div className="editor-toolbar">
        <Space size={0} split={<Divider type="vertical" />} wrap>
          <Tooltip title="一级标题 (# )">
            <Button
              type={editor.isActive('heading', { level: 1 }) ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </Button>
          </Tooltip>
          <Tooltip title="二级标题 (## )">
            <Button
              type={editor.isActive('heading', { level: 2 }) ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </Button>
          </Tooltip>
          <Tooltip title="加粗 (**)">
            <Button
              type={editor.isActive('bold') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<BoldOutlined />}
              onClick={() => editor.chain().focus().toggleBold().run()}
            />
          </Tooltip>
          <Tooltip title="斜体 (*)">
            <Button
              type={editor.isActive('italic') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<ItalicOutlined />}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            />
          </Tooltip>
          <Tooltip title="删除线 (~~)">
            <Button
              type={editor.isActive('strike') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<StrikethroughOutlined />}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
          </Tooltip>
          <Tooltip title="无序列表 (- )">
            <Button
              type={editor.isActive('bulletList') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<UnorderedListOutlined />}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
          </Tooltip>
          <Tooltip title="有序列表 (1. )">
            <Button
              type={editor.isActive('orderedList') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<OrderedListOutlined />}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
          </Tooltip>
          <Tooltip title="引用 (> )">
            <Button
              type={editor.isActive('blockquote') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              引用
            </Button>
          </Tooltip>
          <Tooltip title="代码块">
            <Button
              type={editor.isActive('codeBlock') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              代码
            </Button>
          </Tooltip>
          <Tooltip title="撤销">
            <Button
              type="text"
              size="small"
              style={toolbarBtn}
              icon={<UndoOutlined />}
              disabled={!editor.can().undo()}
              onClick={() => editor.chain().focus().undo().run()}
            />
          </Tooltip>
          <Tooltip title="重做">
            <Button
              type="text"
              size="small"
              style={toolbarBtn}
              icon={<RedoOutlined />}
              disabled={!editor.can().redo()}
              onClick={() => editor.chain().focus().redo().run()}
            />
          </Tooltip>
        </Space>
      </div>

      {/* ProseMirror 编辑区：输入即渲染 = 实时预览 */}
      <EditorContent editor={editor} className="editor-content" />

      <Typography.Paragraph type="secondary" className="editor-meta">
        创建于 {new Date(note.created_at).toLocaleString('zh-CN')} · 更新于{' '}
        {new Date(note.updated_at).toLocaleString('zh-CN')}
      </Typography.Paragraph>
    </div>
  );
}
