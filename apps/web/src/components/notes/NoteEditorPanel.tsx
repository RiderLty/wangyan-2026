import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { Button, Divider, Dropdown, Empty, Input, Modal, Select, Space, Tag, Tooltip, Typography, Avatar } from 'antd';
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
  TeamOutlined,
  ApiOutlined,
  ShareAltOutlined,
  HistoryOutlined,
  DownloadOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  ExpandOutlined,
  CompressOutlined,
  TableOutlined,
  PictureOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { TOKEN_KEY } from '../../api/client';
import type { NoteDetail, NoteTagInfo, TagInfo } from '../../api/notes';
import { exportMarkdown, openPrintView } from '../../utils/export';
import { markdownContentExtensions } from '../../utils/editor-extensions';
import { useAuth } from '../../auth/AuthContext';

/**
 * Tiptap 协作编辑器面板（论文 5.4.2 Yjs前端集成 / 5.4.3 多用户光标同步）
 *
 * 5.3→5.4 演进：正文改由 Yjs 驱动——
 * - Collaboration 扩展把编辑器绑定到 Y.Doc 的 'default' fragment，
 *   文档初值由服务端从 notes.content 快照播种（见服务端 collaboration.persistence.ts）
 * - WebsocketProvider 经 /ws 代理连服务端 y-websocket，增量与 awareness 双向同步
 * - 历史撤销从 ProseMirror history 切换为 Yjs UndoManager（StarterKit.history:false）
 * - 标题仍走 PATCH 自动保存；正文由服务端在"编辑会话结束"时合并回写 JSONB 快照（D-007）
 */

const USER_COLORS = [
  '#f5222d', '#fa541c', '#fa8c16', '#52c41a',
  '#13c2c2', '#1677ff', '#722ed1', '#eb2f96',
];

/** 按用户名哈希取稳定颜色（同一用户在多端颜色一致，论文 4.4.3 用户感知） */
function colorFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return USER_COLORS[h % USER_COLORS.length];
}

interface OnlineUser {
  clientID: number;
  name: string;
  color: string;
}

const toolbarBtn = { paddingInline: 8, paddingInlineEnd: 8 };

/** 保存状态指示：标题防抖 PATCH（正文由服务端协作回写） */
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
    return <span className="save-status save-status-error">保存失败，请重试</span>;
  return (
    <span className="save-status">
      <CheckOutlined /> 已保存
    </span>
  );
}

/** 实时协作状态区（5.4.3 用户感知）：连接状态 + 在线成员头像 */
function CollabStatus({
  connected,
  onlineUsers,
}: {
  connected: boolean;
  onlineUsers: OnlineUser[];
}) {
  return (
    <Tooltip
      title={
        connected
          ? `实时协作已连接，当前 ${onlineUsers.length + 1} 人在线`
          : '正在连接实时协作服务器…'
      }
    >
      <span className="collab-status">
        {connected ? (
          <ApiOutlined style={{ color: '#52c41a' }} />
        ) : (
          <LoadingOutlined style={{ color: '#faad14' }} />
        )}
        <Avatar.Group maxCount={3} size="small">
          {onlineUsers.map((u) => (
            <Tooltip key={u.clientID} title={u.name}>
              <Avatar style={{ backgroundColor: u.color, fontSize: 12 }}>
                {u.name.charAt(0)}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          <TeamOutlined /> {onlineUsers.length + 1}
        </span>
      </span>
    </Tooltip>
  );
}

export interface NoteEditorPanelProps {
  note: NoteDetail | null;
  noteTags: NoteTagInfo[];
  allTags: TagInfo[];
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
  /** 5.5.3 RBAC：team_read 成员只读（服务端同样拒绝写入） */
  editable: boolean;
  /** 仅笔记 owner / 团队 owner+admin 可调整可见性 */
  canManageVisibility: boolean;
  /** 5.6：可分享 = 笔记 owner / 团队 owner+admin（服务端同样校验） */
  canShare: boolean;
  /** 专注模式（5.3.5 布局优化）：编辑器独占整页，Esc 也可退出 */
  focusMode: boolean;
  onToggleFocus: () => void;
  onShare: () => void;
  /** 5.7：版本历史入口（任意可见成员可查看，回滚在服务端校验） */
  onOpenVersions: () => void;
  onVisibilityChange: (visibility: 'private' | 'team_read' | 'team_edit') => void;
  onTitleChange: (title: string) => void;
  onAttachTag: (tagId: string) => void;
  onDetachTag: (tagId: string) => void;
}

export default function NoteEditorPanel({
  note,
  noteTags,
  allTags,
  saveStatus,
  editable,
  canManageVisibility,
  canShare,
  focusMode,
  onToggleFocus,
  onShare,
  onOpenVersions,
  onVisibilityChange,
  onTitleChange,
  onAttachTag,
  onDetachTag,
}: NoteEditorPanelProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    setTitle(note?.title ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  // 协作会话：每篇笔记一个 Y.Doc + WebsocketProvider。
  // 用 useEffect 管理生命周期（useMemo 在 StrictMode 双调用下会泄漏废弃连接）
  const wsUrl = useMemo(
    () => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
    [],
  );
  const [session, setSession] = useState<{ ydoc: Y.Doc; provider: WebsocketProvider } | null>(
    null,
  );
  useEffect(() => {
    // 只读成员（team_read）不建立协作会话：服务端拒绝其 WS 连接（防写穿），
    // 走 REST 快照只读渲染（ReadableView）
    if (!note || !editable) {
      setSession(null);
      return;
    }
    const ydoc = new Y.Doc();
    const p = new WebsocketProvider(wsUrl, note.id, ydoc, {
      params: { token: localStorage.getItem(TOKEN_KEY) ?? '' },
    });
    p.on('status', (evt: { status: string }) => setConnected(evt.status === 'connected'));
    p.awareness.on('change', () => {
      const users: OnlineUser[] = [];
      p.awareness.getStates().forEach((state, clientID) => {
        const u = (state as { user?: { name: string; color: string } }).user;
        if (u && clientID !== p.awareness.clientID) {
          users.push({ clientID, name: u.name, color: u.color });
        }
      });
      setOnlineUsers(users);
    });
    setSession({ ydoc, provider: p });
    return () => {
      setConnected(false);
      setOnlineUsers([]);
      p.destroy();
      ydoc.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, editable, wsUrl]);

  if (!note) {
    return (
      <div className="editor-panel editor-empty">
        <Empty description="选择左侧笔记，或新建一篇开始编辑" />
      </div>
    );
  }

  // 团队只读成员：REST 快照只读渲染（论文 4.5.2 team_read）
  if (!editable) {
    return <ReadableView key={note.id} note={note} />;
  }

  // 协作会话尚未建立（Y.Doc/Provider 初始化中）
  if (!session) {
    return (
      <div className="editor-panel editor-empty">
        <Empty description="正在建立协作会话…" />
      </div>
    );
  }

  const attachableTags = allTags.filter((t) => !noteTags.some((nt) => nt.id === t.id));

  // 会话就绪后才挂载编辑器体（key=Y.Doc clientID）：保证 useEditor 创建时
  // Collaboration/Cursor 必然在场，避免 deps 异步重建导致的旧实例渲染
  return (
    <EditorBody
      key={session!.ydoc.clientID}
      ydoc={session!.ydoc}
      provider={session!.provider}
      username={user?.username ?? '我'}
      title={title}
      saveStatus={saveStatus}
      connected={connected}
      onlineUsers={onlineUsers}
      note={note}
      noteTags={noteTags}
      attachableTags={attachableTags}
      editable={editable}
      canManageVisibility={canManageVisibility}
      canShare={canShare}
      focusMode={focusMode}
      onToggleFocus={onToggleFocus}
      onShare={onShare}
      onOpenVersions={onOpenVersions}
      onVisibilityChange={onVisibilityChange}
      onTitleInput={setTitle}
      onTitleChange={onTitleChange}
      onAttachTag={onAttachTag}
      onDetachTag={onDetachTag}
    />
  );
}

/** 编辑器主体：仅协作会话就绪后挂载（论文 5.4.2） */
function EditorBody({
  ydoc,
  provider,
  username,
  title,
  saveStatus,
  connected,
  onlineUsers,
  note,
  noteTags,
  attachableTags,
  editable,
  canManageVisibility,
  canShare,
  focusMode,
  onToggleFocus,
  onShare,
  onOpenVersions,
  onVisibilityChange,
  onTitleInput,
  onTitleChange,
  onAttachTag,
  onDetachTag,
}: {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  username: string;
  title: string;
  saveStatus: 'saved' | 'pending' | 'saving' | 'error';
  connected: boolean;
  onlineUsers: OnlineUser[];
  note: NoteDetail;
  noteTags: NoteTagInfo[];
  attachableTags: TagInfo[];
  editable: boolean;
  canManageVisibility: boolean;
  canShare: boolean;
  /** 专注模式（5.3.5 布局优化）：编辑器独占整页，Esc 也可退出 */
  focusMode: boolean;
  onToggleFocus: () => void;
  onShare: () => void;
  onOpenVersions: () => void;
  onVisibilityChange: (visibility: 'private' | 'team_read' | 'team_edit') => void;
  onTitleInput: (title: string) => void;
  onTitleChange: (title: string) => void;
  onAttachTag: (tagId: string) => void;
  onDetachTag: (tagId: string) => void;
}) {
  // 图片插入弹窗（5.3.2 图片语法支持：URL 方式，与 Markdown ![]() 对应）
  const [imgModal, setImgModal] = useState<{ open: boolean; url: string } | null>(null);
  const editor = useEditor({
    extensions: [
      // 历史撤销交给 Yjs UndoManager（协作下 ProseMirror history 不可用）
      StarterKit.configure({ history: false }),
      ...markdownContentExtensions(),
      Placeholder.configure({
        placeholder: '开始写点什么…（输入 # 、- 、> 等Markdown语法试试）',
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: username, color: colorFor(username) },
      }),
    ],
    // GitHub 官方 Markdown 渲染样式（github-markdown-light.css 以 .markdown-body 为作用域）
    editorProps: { attributes: { class: 'markdown-body' } },
    editable,
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return null;
  }

  return (
    <div className="editor-panel">
      {/* 笔记标题 + 团队可见性 + 协作状态 + 保存状态 */}
      <div className="editor-header">
        <Input
          variant="borderless"
          size="large"
          value={title}
          placeholder="未命名笔记"
          maxLength={200}
          disabled={!editable}
          onChange={(e) => {
            onTitleInput(e.target.value);
            onTitleChange(e.target.value);
          }}
        />
        {/* 团队笔记可见性（5.5.3，仅 owner/团队管理员可改） */}
        {note.team_id && canManageVisibility && (
          <Select
            size="small"
            value={note.visibility}
            style={{ minWidth: 96 }}
            onChange={(v) => onVisibilityChange(v as 'private' | 'team_read' | 'team_edit')}
            options={[
              { value: 'private', label: '🔒 仅自己' },
              { value: 'team_read', label: '👁 团队可读' },
              { value: 'team_edit', label: '✏ 团队可编辑' },
            ]}
          />
        )}
        {note.team_id && !canManageVisibility && (
          <Tag>{note.visibility === 'team_read' ? '团队只读' : note.visibility === 'team_edit' ? '团队可编辑' : '私有'}</Tag>
        )}
        {/* 分享入口（5.6.1，仅 owner/团队管理员可见） */}
        {canShare && (
          <Tooltip title="生成分享链接">
            <Button size="small" icon={<ShareAltOutlined />} onClick={onShare}>
              分享
            </Button>
          </Tooltip>
        )}
        {/* 版本历史（5.7.1） */}
        <Tooltip title="版本历史与回滚">
          <Button size="small" icon={<HistoryOutlined />} onClick={onOpenVersions} />
        </Tooltip>
        {/* 导出（5.8）：Markdown 直接下载；PDF 走打印视图 */}
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'markdown',
                icon: <FileMarkdownOutlined />,
                label: '导出 Markdown（.md）',
                onClick: () => {
                  exportMarkdown(note);
                },
              },
              {
                key: 'pdf',
                icon: <FilePdfOutlined />,
                label: '导出 PDF（打印视图）',
                onClick: () => openPrintView(note.id),
              },
            ],
          }}
        >
          <Button size="small" icon={<DownloadOutlined />}>
            导出
          </Button>
        </Dropdown>
        <CollabStatus connected={connected} onlineUsers={onlineUsers} />
        <SaveStatus status={saveStatus} />
        {/* 专注模式（5.3.5 布局优化）：隐藏两侧栏与顶栏，编辑器独占整页 */}
        <Tooltip title={focusMode ? '退出专注模式（Esc）' : '专注模式（编辑器独占整页）'}>
          <Button
            size="small"
            icon={focusMode ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={onToggleFocus}
          />
        </Tooltip>
      </div>

      {/* 标签行（个人笔记专属：标签按 D-007 归个人所有） */}
      {!note.team_id && (
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
      )}

      {/* 工具栏（5.3.2：Markdown 语法即时渲染，工具栏提供等价按钮；只读态禁用） */}
      <div className={`editor-toolbar${editable ? '' : ' editor-toolbar-readonly'}`}>
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
          {/* 图片/表格（5.3.2：Markdown ![]() 与管道表格的等价按钮） */}
          <Tooltip title="插入图片（Markdown: ![](url)）">
            <Button
              type="text"
              size="small"
              style={toolbarBtn}
              icon={<PictureOutlined />}
              onClick={() => setImgModal({ open: true, url: '' })}
            />
          </Tooltip>
          <Tooltip title="插入 3×3 表格（Markdown 管道语法）">
            <Button
              type={editor.isActive('table') ? 'primary' : 'text'}
              size="small"
              style={toolbarBtn}
              icon={<TableOutlined />}
              onClick={() =>
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
              }
            />
          </Tooltip>
          {editor.isActive('table') && (
            <Tooltip title="删除当前表格">
              <Button
                type="text"
                size="small"
                danger
                style={toolbarBtn}
                icon={<DeleteOutlined />}
                onClick={() => editor.chain().focus().deleteTable().run()}
              />
            </Tooltip>
          )}
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

      {/* ProseMirror 编辑区：Yjs 驱动，多端实时同步（5.4.2） */}
      <EditorContent editor={editor} className="editor-content" />

      <Typography.Paragraph type="secondary" className="editor-meta">
        创建于 {new Date(note.created_at).toLocaleString('zh-CN')} · 更新于{' '}
        {new Date(note.updated_at).toLocaleString('zh-CN')}
      </Typography.Paragraph>

      {/* 插入图片弹窗：URL 方式（与 Markdown ![](url) 等价） */}
      <Modal
        open={!!imgModal?.open}
        title="插入图片"
        okText="插入"
        cancelText="取消"
        onOk={() => {
          const url = imgModal?.url.trim();
          if (url) editor.chain().focus().setImage({ src: url }).run();
          setImgModal(null);
        }}
        onCancel={() => setImgModal(null)}
        destroyOnClose
      >
        <Input
          placeholder="图片 URL（https://… 或相对路径）"
          value={imgModal?.url}
          onChange={(e) => setImgModal((m) => (m ? { ...m, url: e.target.value } : m))}
          onPressEnter={() => {
            const url = imgModal?.url.trim();
            if (url) editor.chain().focus().setImage({ src: url }).run();
            setImgModal(null);
          }}
        />
      </Modal>
    </div>
  );
}

/** 团队只读视图（论文 4.5.2 team_read）：REST 快照渲染，无协作会话 */
function ReadableView({ note }: { note: NoteDetail }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ history: false }), ...markdownContentExtensions()],
    content: note.content as never,
    editorProps: { attributes: { class: 'markdown-body' } },
    editable: false,
  });
  return (
    <div className="editor-panel">
      <div className="editor-header">
        <Input variant="borderless" size="large" value={note.title} disabled />
        <Tag>🔒 团队只读</Tag>
      </div>
      <EditorContent editor={editor} className="editor-content editor-content-readonly" />
      <Typography.Paragraph type="secondary" className="editor-meta">
        创建于 {new Date(note.created_at).toLocaleString('zh-CN')} · 更新于{' '}
        {new Date(note.updated_at).toLocaleString('zh-CN')} · 团队只读笔记不可编辑
      </Typography.Paragraph>
    </div>
  );
}
