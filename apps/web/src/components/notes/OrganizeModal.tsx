import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Modal, Space, Tag, Typography, message } from 'antd';
import { CloudOutlined, ReloadOutlined } from '@ant-design/icons';
import { aiApi, type BatchStatus, type NoteAiMeta } from '../../api/ai';

/**
 * AI 整理弹窗（论文 5.10 L2，v2.0 计划 M3）：摘要卡 + 标签建议一键采纳 + 存量批量整理。
 * 从 AI 助手抽屉的"整理本笔记"入口打开。
 */
export default function OrganizeModal({
  open,
  noteId,
  noteTitle,
  onClose,
  onTagsApplied,
}: {
  open: boolean;
  noteId: string;
  noteTitle: string;
  onClose: () => void;
  /** 标签采纳成功后通知父级刷新标签列表 */
  onTagsApplied?: () => void;
}) {
  const [meta, setMeta] = useState<NoteAiMeta | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    aiApi
      .getMeta(noteId)
      .then((r) => {
        setMeta(r.data);
        setSelected(r.data.suggested_tags ?? []);
      })
      .catch(() => message.error('加载 AI 元数据失败'));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId]);

  async function regenerate() {
    setOrganizing(true);
    try {
      const r = await aiApi.organize(noteId);
      setMeta(r.data);
      setSelected(r.data.suggested_tags ?? []);
      message.success('整理完成');
    } catch (err) {
      message.error((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '整理失败');
    } finally {
      setOrganizing(false);
    }
  }

  async function adoptTags() {
    if (!selected.length) return;
    try {
      const r = await aiApi.applyTags(noteId, selected);
      message.success(`已采纳标签：${r.data.attached.join('、')}`);
      onTagsApplied?.();
    } catch (err) {
      message.error((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '采纳失败');
    }
  }

  async function startBatch() {
    const r = await aiApi.startBatch();
    setBatch(r.data);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await aiApi.batchStatus();
      setBatch(s.data ?? null);
      if (!s.data?.running && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        message.success(`批量整理完成：成功 ${s.data?.done ?? 0} 篇，失败 ${s.data?.failed ?? 0} 篇`);
      }
    }, 2000);
  }

  return (
    <Modal
      open={open}
      title={`AI 整理：《${noteTitle.slice(0, 20)}》`}
      footer={null}
      onCancel={onClose}
      width={480}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size={14}>
        {/* 摘要卡 */}
        <div>
          <Space>
            <Typography.Text strong>摘要</Typography.Text>
            <Button size="small" icon={<ReloadOutlined />} loading={organizing} onClick={regenerate}>
              {meta?.summary ? '重新生成' : '生成'}
            </Button>
          </Space>
          <Typography.Paragraph
            type={meta?.summary ? undefined : 'secondary'}
            style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px', marginTop: 8, marginBottom: 0 }}
          >
            {organizing ? 'AI 正在阅读全文…' : (meta?.summary ?? '尚无摘要，点击"生成"让 AI 阅读全文并提炼。')}
          </Typography.Paragraph>
        </div>
        {/* 标签建议（一键采纳，转正进 5.3.3 标签体系） */}
        <div>
          <Space>
            <Typography.Text strong>标签建议</Typography.Text>
            {meta?.suggested_tags?.length ? (
              <Button size="small" type="primary" ghost disabled={!selected.length} onClick={adoptTags}>
                采纳所选（{selected.length}）
              </Button>
            ) : null}
          </Space>
          <div style={{ marginTop: 8 }}>
            {meta?.suggested_tags?.length ? (
              <Checkbox.Group
                value={selected}
                onChange={(v) => setSelected(v as string[])}
                options={meta.suggested_tags.map((t) => ({ label: <Tag color="blue">{t}</Tag>, value: t }))}
              />
            ) : (
              <Typography.Text type="secondary">生成摘要后一并给出标签建议。</Typography.Text>
            )}
          </div>
        </div>
        {/* 存量批量整理（后台顺序任务，进度轮询） */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <Space>
            <Typography.Text strong>批量整理历史笔记</Typography.Text>
            <Button size="small" icon={<CloudOutlined />} onClick={startBatch} disabled={!!batch?.running}>
              启动（≤20 篇/轮）
            </Button>
          </Space>
          {batch && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              {batch.running
                ? `后台整理中：${batch.done + batch.failed}/${batch.total}（失败 ${batch.failed}）…`
                : batch.total > 0
                  ? `上次批量：成功 ${batch.done} 篇，失败 ${batch.failed} 篇。`
                  : '没有待整理的笔记（全部已生成 AI 元数据）。'}
            </Typography.Paragraph>
          )}
        </div>
      </Space>
    </Modal>
  );
}
