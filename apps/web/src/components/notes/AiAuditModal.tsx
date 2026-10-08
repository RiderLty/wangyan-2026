import { useEffect, useState } from 'react';
import { Modal, Table, Tag, Typography } from 'antd';
import { aiApi } from '../../api/ai';

/**
 * AI 工具调用审计弹窗（论文 5.10.3 收敛规则的界面呈现：谁、何时、调了什么、结果）。
 * 数据源：ai_messages（agent loop 落库），M2 审计数据的可视化端。
 */
const TOOL_LABELS: Record<string, string> = {
  search_notes: '搜索笔记',
  get_note: '读取笔记',
  create_note: '创建笔记',
  update_note: '更新笔记',
  create_share_link: '生成分享链接',
};

export default function AiAuditModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<{ time: string; name: string; args: string; ok: boolean; result: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    aiApi
      .audit()
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} title="AI 工具调用审计（最近 50 条）" footer={null} onCancel={onClose} width={640} destroyOnClose>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        Agent 的每次工具调用都以当前用户身份经过权限校验并落库，此表为操作留痕（5.10.3 收敛规则）。
      </Typography.Paragraph>
      <Table
        size="small"
        loading={loading}
        dataSource={rows}
        rowKey={(r) => r.time + r.name + r.args}
        pagination={{ pageSize: 8 }}
        columns={[
          { title: '时间', dataIndex: 'time', width: 110, render: (t) => new Date(t).toLocaleString('zh-CN') },
          { title: '工具', dataIndex: 'name', width: 100, render: (n) => <Tag>{TOOL_LABELS[n] ?? n}</Tag> },
          { title: '参数', dataIndex: 'args', ellipsis: true },
          {
            title: '结果',
            dataIndex: 'ok',
            width: 180,
            render: (ok, r) => (
              <Tag color={ok ? 'green' : 'red'}>{ok ? '成功' : `拒绝：${(r.result || '').slice(0, 30)}`}</Tag>
            ),
          },
        ]}
      />
    </Modal>
  );
}
