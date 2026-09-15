import { useEffect, useMemo, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { Alert, Avatar, Button, Result, Spin, Tag, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { shareContent, resolveShare, type ShareMeta } from '../api/share';
import { markdownContentExtensions } from '../utils/editor-extensions';

/**
 * 公开分享页（论文 5.6.2 链接访问权限控制 / 3.2.4 访客角色）
 * 无需登录：/s/:token
 * - read 链接：REST 快照只读渲染
 * - edit 链接：以 ?share=token 加入 Yjs 实时协作（服务端鉴权），访客可编辑（7.2.1 卖点串联）
 * 失效/停用/过期 → 统一失效提示（不区分原因，防枚举）
 */

const GUEST_COLORS = ['#f5222d', '#fa8c16', '#52c41a', '#13c2c2', '#1677ff', '#722ed1'];

export default function SharePage() {
  const { token = '' } = useParams();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const m = await resolveShare(token);
        setMeta(m);
        const c = await shareContent(token);
        setContent(c.content);
      } catch {
        setFailed(true);
      }
    })();
  }, [token]);

  if (failed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
        <Result
          status="404"
          title="链接已失效"
          subTitle="分享链接不存在、已被停用或已过期"
          extra={
            <Button type="primary" href="/">
              访问平台首页
            </Button>
          }
        />
      </div>
    );
  }

  if (!meta || !content) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return <SharedDoc key={token} meta={meta} content={content} token={token} />;
}

/** 已解析的分享文档：read 只读渲染 / edit 挂访客协作（5.6.2） */
function SharedDoc({
  meta,
  content,
  token,
}: {
  meta: ShareMeta;
  content: Record<string, unknown>;
  token: string;
}) {
  const editable = meta.permission === 'edit';

  // 访客协作会话：Y.Doc + ?share=token 鉴权（服务端 RealtimeService 校验）
  const [session, setSession] = useState<{ ydoc: Y.Doc; provider: WebsocketProvider } | null>(
    null,
  );
  const [connected, setConnected] = useState(false);
  const wsUrl = useMemo(
    () => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
    [],
  );

  useEffect(() => {
    if (!editable) return;
    const ydoc = new Y.Doc();
    const p = new WebsocketProvider(wsUrl, meta.note_id, ydoc, { params: { share: token } });
    p.on('status', (evt: { status: string }) => setConnected(evt.status === 'connected'));
    setSession({ ydoc, provider: p });
    return () => {
      p.destroy();
      ydoc.destroy();
    };
  }, [editable, meta.note_id, token, wsUrl]);

  const editor = useEditor(
    {
      extensions: [
        // 协作模式下历史交给 Yjs UndoManager；只读快照用默认 ProseMirror history
        StarterKit.configure(...(editable ? [{ history: false }] as const : [])),
        ...markdownContentExtensions(),
        ...(session
          ? [
              Collaboration.configure({ document: session.ydoc }),
              CollaborationCursor.configure({
                provider: session.provider,
                user: {
                  name: '访客',
                  color: GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)],
                },
              }),
            ]
          : []),
      ],
      // GitHub 官方 Markdown 渲染样式
      editorProps: { attributes: { class: 'markdown-body' } },
      content: session ? undefined : (content as never),
      editable,
    },
    [session],
  );
  void editor?.isEditable;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 顶栏（访客视角） */}
      <div className="share-header">
        <Typography.Text strong style={{ fontSize: 16 }}>
          在线Markdown笔记平台 · 分享文档
        </Typography.Text>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {editable && (
            <Tag color={connected ? 'green' : 'gold'}>
              {connected ? '实时协作已连接 · 可编辑' : '正在连接协作…'}
            </Tag>
          )}
          <Avatar size="small" style={{ backgroundColor: '#fa8c16' }}>
            客
          </Avatar>
          <span style={{ color: '#fff', fontSize: 13 }}>访客</span>
        </span>
      </div>

      <div className="share-body">
        <div className="share-card">
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {meta.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            分享文档 ·{' '}
            {meta.expires_at
              ? `${new Date(meta.expires_at).toLocaleString('zh-CN')} 前有效`
              : '永久有效'}
            {editable ? ' · 访客可参与编辑' : ' · 只读'}
          </Typography.Paragraph>
          {editable && !connected && (
            <Alert
              type="info"
              showIcon
              message="正在连接实时协作服务器，连接后可编辑"
              style={{ marginBottom: 12 }}
            />
          )}
          {editor && <EditorContent editor={editor} className="editor-content share-content" />}
        </div>
      </div>
    </div>
  );
}
