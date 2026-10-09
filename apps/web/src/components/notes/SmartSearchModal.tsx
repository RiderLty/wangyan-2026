import { useState } from 'react';
import { Button, Empty, Input, Modal, Space, Spin, Tag, Typography, message } from 'antd';
import { SearchOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { aiApi, type HybridHit } from '../../api/ai';

/**
 * AI 智能搜索弹窗（论文 5.10 L3，v2.0 计划 M4）：
 * 关键词 ILIKE ∪ 向量语义 → RRF 融合结果 + RAG 问答（带 [n] 出处）。
 * 与 5.3.4 的关键词列表过滤互补：语义通道覆盖"按意思找笔记"。
 */
export default function SmartSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<HybridHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState<{ id: string; title: string; snippet: string }[]>([]);
  const [asking, setAsking] = useState(false);

  function doSearch(question?: string) {
    const query = (question ?? q).trim();
    if (!query) return;
    setSearching(true);
    setAnswer('');
    setSources([]);
    aiApi
      .search(query)
      .then((r) => setHits(r.data))
      .catch(() => message.error('智能搜索失败'))
      .finally(() => setSearching(false));
  }

  function doAsk() {
    const query = q.trim();
    if (!query) return;
    setAsking(true);
    setAnswer('');
    aiApi
      .ask(query)
      .then((r) => {
        setAnswer(r.data.answer);
        setSources(r.data.sources);
        if (!hits) doSearch();
      })
      .catch(() => message.error('AI 问答失败'))
      .finally(() => setAsking(false));
  }

  const matchedColor = (m: HybridHit['matched']) => (m === '混合' ? 'purple' : m === '语义' ? 'geekblue' : 'green');

  return (
    <Modal
      open={open}
      title="AI 智能搜索（关键词 + 语义混合）"
      footer={null}
      onCancel={onClose}
      width={560}
      destroyOnClose
    >
      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onPressEnter={() => doSearch()}
          placeholder="输入关键词或用一句话描述，如：我写过的关于部署踩坑的笔记"
          maxLength={200}
        />
        <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={() => doSearch()}>
          检索
        </Button>
        <Button icon={<ThunderboltOutlined />} loading={asking} onClick={doAsk}>
          问 AI
        </Button>
      </Space.Compact>

      {/* RAG 回答块（带 [n] 出处标注） */}
      {(asking || answer) && (
        <div style={{ background: '#f9f0ff', borderRadius: 8, padding: '10px 12px', marginTop: 12 }}>
          <Typography.Text strong>AI 回答</Typography.Text>
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, marginTop: 6 }}>
            {asking ? <Spin size="small" /> : answer}
          </Typography.Paragraph>
          {!!sources.length && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {sources.map((s, i) => (
                <Tag key={s.id} style={{ marginBottom: 4 }}>
                  [{i + 1}] {s.title.slice(0, 16)}
                </Tag>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 混合检索结果 */}
      <div style={{ marginTop: 12 }}>
        {searching && <Spin style={{ display: 'block', margin: '24px auto' }} />}
        {!searching && hits !== null && hits.length === 0 && <Empty description="没有命中的笔记" />}
        {!searching &&
          hits?.map((h) => (
            <div key={h.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
              <Space size={6}>
                <Tag color={matchedColor(h.matched)}>{h.matched}</Tag>
                <Typography.Text strong>{h.title}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  RRF {h.score.toFixed(4)}
                </Typography.Text>
              </Space>
              {h.snippet && (
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                  {h.snippet.slice(0, 120)}
                </Typography.Paragraph>
              )}
            </div>
          ))}
        {!searching && hits === null && (
          <Typography.Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24 }}>
            检索范围：你的个人笔记与所在团队的可读笔记（与权限矩阵同口径）。
          </Typography.Paragraph>
        )}
      </div>
    </Modal>
  );
}
