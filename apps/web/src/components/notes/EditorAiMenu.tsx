import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Button, Dropdown, Input, Modal, Tooltip } from 'antd';
import { RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { streamEditorAi, type EditorAiAction, type EditorAiPayload } from '../../api/ai';

/**
 * 编辑器 AI 菜单（论文 5.10.2 编辑器 AI 与 CRDT 集成，v2.0 计划 L1）
 *
 * AI 输出逐段经 ProseMirror 事务写入本地编辑器——编辑器由 Yjs Collaboration 驱动，
 * 这些事务与人工键入完全同路：作为 CRDT 增量同步到所有协作端、
 * 纳入 Yjs UndoManager 可撤销。AI 因此成为与人类用户共享同一冲突解决链路的"协作者"。
 *
 * 流式期间本地编辑临时锁定（避免本地输入导致流式插入位置漂移），
 * 结束/中断后恢复；Esc 或点击"停止"可中断。
 */

type StreamState =
  | { phase: 'idle' }
  | { phase: 'running'; abort: AbortController; action: EditorAiAction };

export default function EditorAiMenu({ editor, noteId }: { editor: Editor; noteId: string }) {
  const [stream, setStream] = useState<StreamState>({ phase: 'idle' });
  const [customOpen, setCustomOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  // 流式插入的位置游标：每次 dispatch 后按插入量推进
  const posRef = useRef(0);
  // 首个非空增量到达前跳过开头的换行（避免在正文前留下空段）
  const startedRef = useRef(false);

  useEffect(() => {
    if (stream.phase !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.phase]);

  /** 定位插入起点：返回事务起始与初始光标位置（均在文本块内部） */
  function locate(apply: 'insert' | 'replace-selection' | 'doc-end') {
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const tr = state.tr;
    let pos: number;
    if (apply === 'replace-selection' && !empty) {
      tr.delete(from, to);
      pos = from;
    } else if (apply === 'doc-end') {
      const last = state.doc.lastChild;
      if (state.doc.content.size === 0) {
        pos = 0;
      } else if (last?.type.name === 'paragraph' && last.content.size === 0) {
        // 文档以空段落结尾：直接用它承接 AI 文本
        pos = state.doc.content.size - 1;
      } else if (last?.type.name === 'paragraph') {
        // 在最后一段末尾拆分出新的空段落承接（split 后新段起始位 = size-1+1）
        tr.split(state.doc.content.size - 1);
        pos = state.doc.content.size;
      } else {
        // 末尾不是段落（表格/代码块等）：补一个空段落
        tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create());
        pos = state.doc.content.size + 1;
      }
    } else {
      pos = to;
    }
    return { tr, pos };
  }

  /** 流式写入：delta 里的 \n 视为段落边界（split 出新段继续写） */
  function writeDelta(text: string) {
    // 首个增量到达前跳过开头换行，避免正文前留空段
    if (!startedRef.current) {
      text = text.replace(/^\n+/, '');
      if (!text) return;
      startedRef.current = true;
    }
    let pos = posRef.current;
    const parts = text.split('\n');
    parts.forEach((seg, i) => {
      if (i > 0) {
        // 段落边界：在当前位置拆分出新的空段（split 后写入位后移 1）
        editor.view.dispatch(editor.view.state.tr.split(pos));
        pos += 1;
      }
      if (seg) {
        editor.view.dispatch(editor.view.state.tr.insertText(seg, pos));
        pos += seg.length;
      }
    });
    posRef.current = pos;
  }

  function stop() {
    if (stream.phase === 'running') stream.abort.abort();
  }

  function run(action: EditorAiAction, apply: 'insert' | 'replace-selection' | 'doc-end', instructionText?: string) {
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const selected = empty ? '' : state.doc.textBetween(from, to, '\n');

    // 组装请求载荷：与大纲 4.6 的权限模型对齐——AI 写入走与人工编辑同权校验
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

    // 确定插入起点并锁定本地编辑
    const { tr, pos } = locate(apply);
    tr.setMeta('addToHistory', true);
    editor.view.dispatch(tr);
    posRef.current = pos;
    startedRef.current = false;
    editor.setEditable(false);

    const abort = new AbortController();
    setStream({ phase: 'running', abort, action });
    void streamEditorAi(
      payload,
      {
        onDelta: (t) => {
          try {
            writeDelta(t);
          } catch {
            // 位置漂移等异常：终止流并提示，已写入部分保留（可撤销）
            abort.abort();
            message.warning('AI 写入位置异常已停止，已写入内容可撤销（Ctrl+Z）');
          }
        },
        onDone: () => {
          editor.setEditable(true);
          setStream({ phase: 'idle' });
        },
        onError: (msg) => {
          editor.setEditable(true);
          setStream({ phase: 'idle' });
          message.error(msg);
        },
      },
      abort.signal,
    ).then(() => {
      // 中断路径（AbortError 直接 resolve）：恢复编辑状态
      editor.setEditable(true);
      setStream((s) => (s.phase === 'running' && s.abort === abort ? { phase: 'idle' } : s));
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
        <Tooltip title="AI 正在写入，点击停止（Esc）">
          <Button
            type="text"
            size="small"
            danger
            style={{ paddingInline: 8 }}
            icon={<LoadingOutlined />}
            onClick={stop}
          >
            停止
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
