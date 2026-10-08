import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Button, Dropdown, Input, Modal, Tooltip } from 'antd';
import { RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { streamEditorAi, type EditorAiAction, type EditorAiPayload } from '../../api/ai';

/**
 * 编辑器 AI 菜单（论文 5.10.2 编辑器 AI 与 CRDT 集成，v2.0 计划 L1）
 *
 * 写入策略（2026-10-08 实测后定型，D-016 补充）：
 * 流式增量**缓冲不落盘**（工具栏"停止（N 字）"实时计数），完成后把整段
 * Markdown 一次性经 tiptap-markdown 解析为 ProseMirror 节点插入。
 * 原因：逐 delta 纯文本插入会打碎 Markdown 结构（表格管道符/代码块被撕裂），
 * 且数百次微事务造成位置漂移；整块解析插入=单一 CRDT 事务，
 * 协作端原子可见、可整体撤销，Markdown 语义（表格/代码块/标题）完整保留。
 *
 * 流式期间本地编辑锁定（防插入锚点漂移）；Esc/停止中断后插入已生成的部分。
 */

type StreamState =
  | { phase: 'idle' }
  | { phase: 'running'; abort: AbortController; action: EditorAiAction };

/** 插入锚点：start 时记录，完成后应用（数字位置可能在流期间漂移，故带兜底） */
type Anchor =
  | { mode: 'insert'; pos?: number }
  | { mode: 'replace'; from: number; to: number }
  | { mode: 'doc-end' };

export default function EditorAiMenu({ editor, noteId }: { editor: Editor; noteId: string }) {
  const [stream, setStream] = useState<StreamState>({ phase: 'idle' });
  const [customOpen, setCustomOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [chars, setChars] = useState(0);
  const bufRef = useRef('');
  const anchorRef = useRef<Anchor>({ mode: 'doc-end' });
  const appliedRef = useRef(false);

  useEffect(() => {
    if (stream.phase !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase]);

  function stop() {
    if (stream.phase === 'running') stream.abort.abort();
  }

  function finish() {
    editor.setEditable(true);
    setStream({ phase: 'idle' });
  }

  /** 把缓冲的 Markdown 整块解析插入（单一事务；幂等） */
  function applyBuffer() {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const md = bufRef.current.trim();
    if (!md) return;
    try {
      const anchor = anchorRef.current;
      if (anchor.mode === 'replace') {
        editor.chain().deleteRange({ from: anchor.from, to: anchor.to }).insertContentAt(anchor.from, md).run();
      } else if (anchor.mode === 'doc-end') {
        editor.chain().insertContentAt(editor.state.doc.content.size, md).run();
      } else {
        try {
          editor.chain().insertContentAt(anchor.pos ?? editor.state.selection.to, md).run();
        } catch {
          // 锚点漂移兜底：退化为当前光标处
          editor.chain().insertContentAt(editor.state.selection.to, md).run();
        }
      }
    } catch {
      message.warning('AI 内容插入失败，已保留在剪贴板式缓冲（可重试）');
    }
  }

  function run(action: EditorAiAction, apply: 'insert' | 'replace-selection' | 'doc-end', instructionText?: string) {
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const selected = empty ? '' : state.doc.textBetween(from, to, '\n');

    // 组装请求载荷：与 4.5 权限模型对齐——AI 写入走与人工编辑同权校验
    const payload: EditorAiPayload = { action, note_id: noteId };
    if (action === 'continue') {
      // 续写上下文：光标前文（截取尾部 1500 字，防止超长）
      const before = state.doc.textBetween(0, to, '\n');
      payload.text = before.slice(-1500);
    } else if (action === 'summarize') {
      // 全文由服务端从 content_text 取（含标题上下文）
    } else {
      payload.text = selected || undefined;
    }
    if (instructionText) payload.instruction = instructionText;

    // 记录插入锚点并锁定本地编辑
    anchorRef.current =
      apply === 'replace-selection' && !empty
        ? { mode: 'replace', from, to }
        : apply === 'doc-end'
          ? { mode: 'doc-end' }
          : { mode: 'insert', pos: to };
    appliedRef.current = false;
    bufRef.current = '';
    setChars(0);
    editor.setEditable(false);

    const abort = new AbortController();
    setStream({ phase: 'running', abort, action });
    void streamEditorAi(
      payload,
      {
        onDelta: (t) => {
          bufRef.current += t;
          setChars(bufRef.current.length);
        },
        onDone: () => {
          applyBuffer();
          finish();
        },
        onError: (msg) => {
          applyBuffer();
          finish();
          message.error(msg);
        },
      },
      abort.signal,
    ).then(() => {
      // 中断路径（Esc/停止）：插入已生成的部分，恢复编辑
      applyBuffer();
      finish();
    });
  }

  const running = stream.phase === 'running';

  const items = [
    { key: 'continue', label: 'AI 续写（从光标处）' },
    { key: 'polish', label: 'AI 润色（替换选中）' },
    { key: 'translate', label: 'AI 翻译（替换选中）' },
    { key: 'summarize', label: 'AI 摘要（全文，追加文末）' },
    { type: 'divider' as const, key: 'd1' },
    { key: 'custom', label: '自定义指令…' },
  ];

  return (
    <>
      {running ? (
        <Tooltip title="AI 生成中，点击停止（Esc）。停止后已生成内容会插入文档">
          <Button
            type="text"
            size="small"
            danger
            style={{ paddingInline: 8 }}
            icon={<LoadingOutlined />}
            onClick={stop}
          >
            停止{chars > 0 ? `（${chars} 字）` : ''}
          </Button>
        </Tooltip>
      ) : (
        <Dropdown
          trigger={['click']}
          menu={{
            items,
            onClick: ({ key }) => {
              if (key === 'custom') {
                setCustomOpen(true);
                return;
              }
              const action = key as EditorAiAction;
              // 润色/翻译必须有选区（避免整篇被误替换）
              if ((action === 'polish' || action === 'translate') && editor.state.selection.empty) {
                message.info('请先选中要处理的文字');
                return;
              }
              run(action, action === 'summarize' ? 'doc-end' : 'insert');
            },
          }}
        >
          <Button type="text" size="small" style={{ paddingInline: 8 }} icon={<RobotOutlined />}>
            AI
          </Button>
        </Dropdown>
      )}
      <Modal
        open={customOpen}
        title="自定义 AI 指令"
        okText="执行"
        cancelText="取消"
        onCancel={() => setCustomOpen(false)}
        onOk={() => {
          const text = instruction.trim();
          if (!text) return;
          setCustomOpen(false);
          setInstruction('');
          // 有选区→替换选区；无选区→光标处插入
          run('custom', editor.state.selection.empty ? 'insert' : 'replace-selection', text);
        }}
        destroyOnClose
      >
        <Input.TextArea
          rows={3}
          maxLength={2000}
          showCount
          autoFocus
          placeholder="例：把这段改写成三条要点 / 围绕这个主题写一段引言…（有选中文字时作用于选区，否则从光标处写入）"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
      </Modal>
    </>
  );
}
