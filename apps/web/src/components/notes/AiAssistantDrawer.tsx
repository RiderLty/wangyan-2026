import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Input, Space, Tag, Tooltip, Typography } from 'antd';
import { RobotOutlined, SendOutlined, CloseOutlined, FormOutlined, FileSearchOutlined } from '@ant-design/icons';
import { aiApi, streamAgentChat, type HistoryMessage } from '../../api/ai';
import OrganizeModal from './OrganizeModal';
import AiAuditModal from './AiAuditModal';

/**
 * AI 助手对话抽屉（论文 5.10.3，v2.0 计划 L4）——对话式 Agent 驱动系统操作。
 *
 * 消息流呈现：用户气泡 / 助手气泡 / 工具调用链路条（🔧 工具名 ✓/✗ + 参数摘要），
 * 工具条让"AI 操作了什么"透明可审计——对应论文"Agent 权限收敛 + 调用可审计"创新点。
 * conversation_id 由服务端会话保障（meta 事件）返回，同抽屉会话内续接多轮。
 */

interface ToolStep {
  name: string;
  args: string;
  ok: boolean | null; // null=调用中
  summary: string;
}
interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolStep[];
}

/** 工具名 → 中文标签（与服务端 tools.ts 一一对应） */
const TOOL_LABELS: Record<string, string> = {
  search_notes: '搜索笔记',
  get_note: '读取笔记',
  create_note: '创建笔记',
  update_note: '更新笔记',
  create_share_link: '生成分享链接',
};

/** 工具参数摘要："{"keyword":"部署"}" → 「部署」 */
function argSummary(args: string): string {
  try {
    const o = JSON.parse(args) as Record<string, unknown>;
    const vals = Object.values(o).map((v) => String(v).slice(0, 24));
    return vals.length ? vals.join('，') : '';
  } catch {
    return args.slice(0, 30);
  }
}

export default function AiAssistantDrawer({
  open,
  noteId,
  noteTitle,
  onClose,
  onTagsApplied,
}: {
  open: boolean;
  noteId: string;
  noteTitle?: string;
  onClose: () => void;
  /** 标签采纳后通知父级刷新标签列表（编辑器标签行） */
  onTagsApplied?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const convRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef<string>('');

  // 关闭时中断进行中的流
  useEffect(() => {
    if (!open && abortRef.current) abortRef.current.abort();
  }, [open]);

  // 打开时恢复最近会话（服务端 ai_conversations/ai_messages 回放，M3）
  useEffect(() => {
    if (!open || restoredRef.current === noteId) return;
    restoredRef.current = noteId;
    void (async () => {
      try {
        const convs = await aiApi.conversations(noteId);
        const latest = (convs.data as { id: string }[])[0];
        if (!latest) return;
        const msgs = await aiApi.conversationMessages(latest.id);
        convRef.current = latest.id;
        setMessages(
          (msgs.data as HistoryMessage[]).map((m) => ({
            role: m.role,
            content: m.content ?? '',
            tools: m.tools?.map((t) => ({ name: t.name, args: t.args, ok: t.ok, summary: t.summary })),
          })),
        );
      } catch {
        /* 历史恢复失败静默（新会话兜底） */
      }
    })();
  }, [open, noteId]);

  // 新消息自动滚底
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '', tools: [] }]);

    const abort = new AbortController();
    abortRef.current = abort;
    const patchLast = (fn: (m: ChatMsg) => ChatMsg) =>
      setMessages((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);

    void streamAgentChat(
      { conversation_id: convRef.current, note_id: noteId, message: text },
      {
        onMeta: (cid) => {
          convRef.current = cid;
        },
        onDelta: (t) => patchLast((m) => ({ ...m, content: m.content + t })),
        onToolCall: (name, args) =>
          patchLast((m) => ({
            ...m,
            tools: [...(m.tools ?? []), { name, args, ok: null, summary: '' }],
          })),
        onToolResult: (name, ok, summary) =>
          patchLast((m) => {
            const tools = [...(m.tools ?? [])];
            for (let i = tools.length - 1; i >= 0; i--) {
              if (tools[i].name === name && tools[i].ok === null) {
                tools[i] = { ...tools[i], ok, summary };
                break;
              }
            }
            return { ...m, tools };
          }),
        onDone: () => setBusy(false),
        onError: (msg) => {
          patchLast((m) => ({ ...m, content: m.content || `⚠️ ${msg}` }));
          setBusy(false);
        },
      },
      abort.signal,
    ).then(() => setBusy(false));
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={440}
      title={
        <span>
          <RobotOutlined /> AI 助手
        </span>
      }
      extra={
        <Space size={2}>
          <Tooltip title="整理本笔记（摘要卡 + 标签建议）">
            <Button size="small" type="text" icon={<FormOutlined />} onClick={() => setOrganizeOpen(true)} />
          </Tooltip>
          <Tooltip title="工具调用审计">
            <Button size="small" type="text" icon={<FileSearchOutlined />} onClick={() => setAuditOpen(true)} />
          </Tooltip>
          <Tooltip title="清空对话（新建会话）">
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => { convRef.current = undefined; setMessages([]); }} />
          </Tooltip>
        </Space>
      }
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* 消息列表 */}
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 2px' }}>
          {messages.length === 0 && (
            <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24 }}>
              让我帮你操作笔记：可以搜索、撰写、整理笔记，也能生成分享链接。
              <br />
              例如："把本周的部署记录整理成一篇周报，然后生成一个 7 天有效的只读分享链接"
            </Typography.Paragraph>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ margin: '8px 0', textAlign: m.role === 'user' ? 'right' : 'left' }}>
              {m.role === 'user' ? (
                <span
                  style={{
                    display: 'inline-block', maxWidth: '85%', padding: '6px 12px', borderRadius: 12,
                    background: '#e6f4ff', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                >
                  {m.content}
                </span>
              ) : (
                <div style={{ textAlign: 'left' }}>
                  {/* 工具调用链路条：透明可审计（5.10.3 收敛规则的界面呈现） */}
                  {m.tools?.map((t, j) => (
                    <div key={j} style={{ margin: '4px 0', fontSize: 12 }}>
                      <Tag color={t.ok === null ? 'processing' : t.ok ? 'green' : 'red'}>
                        {TOOL_LABELS[t.name] ?? t.name}
                      </Tag>
                      <span style={{ color: '#8c8c8c' }}>
                        {argSummary(t.args)}
                        {t.ok === false && t.summary ? ` · ${t.summary.slice(0, 60)}` : ''}
                      </span>
                    </div>
                  ))}
                  {m.content && (
                    <span
                      style={{
                        display: 'inline-block', maxWidth: '92%', padding: '6px 12px', borderRadius: 12,
                        background: '#f5f5f5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}
                    >
                      {m.content}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <Typography.Text type="secondary" style={{ fontSize: 12 }}>AI 处理中…</Typography.Text>}
        </div>
        {/* 输入区 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="对 AI 助手下指令…（Enter 发送，Shift+Enter 换行）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            maxLength={4000}
            disabled={busy}
          />
          <div style={{ textAlign: 'right', marginTop: 6 }}>
            <Button type="primary" size="small" icon={<SendOutlined />} loading={busy} onClick={send}>
              发送
            </Button>
          </div>
        </div>
      </div>
      {/* AI 整理（L2 摘要卡/标签建议/批量整理）与工具调用审计 */}
      <OrganizeModal
        open={organizeOpen}
        noteId={noteId}
        noteTitle={noteTitle ?? ''}
        onClose={() => setOrganizeOpen(false)}
        onTagsApplied={onTagsApplied}
      />
      <AiAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} />
    </Drawer>
  );
}
