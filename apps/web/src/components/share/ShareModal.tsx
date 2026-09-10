import { useCallback, useEffect, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { CopyOutlined, LinkOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  createShare,
  deleteShare,
  listShares,
  setShareEnabled,
  type ShareLinkInfo,
  type SharePermission,
} from '../../api/share';

/**
 * 分享链接管理弹窗（论文 5.6.1 链接生成 / 5.6.3 有效期管理）
 * 生成（权限 + 有效期）、启停、复制、删除；访问计数展示
 */
export default function ShareModal({
  noteId,
  open,
  onClose,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [links, setLinks] = useState<ShareLinkInfo[]>([]);
  const [permission, setPermission] = useState<SharePermission>('read');
  const [expiry, setExpiry] = useState<string>('forever');
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    if (open) setLinks(await listShares(noteId));
  }, [open, noteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shareUrl = (token: string) => `${window.location.origin}/s/${token}`;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const expires_at =
        expiry === 'forever'
          ? null
          : dayjs().add(Number(expiry), 'hour').toISOString();
      const created = await createShare({ note_id: noteId, permission, expires_at });
      const url = shareUrl(created.token);
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      message.success('链接已生成并复制到剪贴板');
      await refresh();
    } catch {
      message.error('生成失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      title="分享笔记"
      footer={null}
      onCancel={onClose}
      width={620}
      destroyOnClose
    >
      {/* 生成新链接（5.6.1 + 5.6.3） */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          value={permission}
          style={{ width: 130 }}
          onChange={setPermission}
          options={[
            { value: 'read', label: '👁 只读' },
            { value: 'edit', label: '✏ 可编辑（可协作）' },
          ]}
        />
        <Select
          value={expiry}
          style={{ width: 120 }}
          onChange={setExpiry}
          options={[
            { value: 'forever', label: '永久有效' },
            { value: '24', label: '24 小时' },
            { value: '168', label: '7 天' },
            { value: '720', label: '30 天' },
          ]}
        />
        <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={() => void handleCreate()}>
          生成链接
        </Button>
      </Space>

      {/* 链接列表 */}
      {links.length === 0 ? (
        <Typography.Text type="secondary">还没有分享链接，选择权限后点"生成链接"</Typography.Text>
      ) : (
        <List
          size="small"
          dataSource={links}
          renderItem={(l) => (
            <List.Item
              actions={[
                <Button
                  key="copy"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(shareUrl(l.token))
                      .then(() => message.success('已复制'))
                      .catch(() => message.info(shareUrl(l.token)));
                  }}
                >
                  复制
                </Button>,
                <Popconfirm
                  key="del"
                  title="删除该链接？"
                  description="访客将立即无法访问"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => {
                    void deleteShare(l.id).then(refresh);
                  }}
                >
                  <Button danger size="small">
                    删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Space size={6} wrap>
                  <Tag color={l.permission === 'edit' ? 'orange' : 'blue'}>
                    {l.permission === 'edit' ? '可编辑' : '只读'}
                  </Tag>
                  <Input
                    size="small"
                    readOnly
                    variant="borderless"
                    value={shareUrl(l.token)}
                    style={{ maxWidth: 260, padding: 0 }}
                    prefix={<LinkOutlined style={{ color: '#bbb' }} />}
                  />
                </Space>
                <Space size={10} style={{ fontSize: 12, color: '#8c8c8c' }}>
                  <span>
                    <Switch
                      size="small"
                      checked={l.is_enabled}
                      onChange={(v) => {
                        void setShareEnabled(l.id, v).then(refresh);
                      }}
                    />{' '}
                    启用
                  </span>
                  <span>
                    有效期：
                    {l.expires_at
                      ? `${dayjs(l.expires_at).format('YYYY-MM-DD HH:mm')} 截止`
                      : '永久'}
                  </span>
                  <span>已访问 {l.visit_count} 次</span>
                </Space>
              </div>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
