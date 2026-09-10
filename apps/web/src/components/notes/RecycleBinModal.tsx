import { useCallback, useEffect, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Empty,
  List,
  Modal,
  Popconfirm,
  Tag,
  Typography,
} from 'antd';
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { listRecycleBin, purgeRecycle, restoreRecycle, type RecycleItem } from '../../api/history';

/**
 * 回收站弹窗（论文 5.7.3 回收站与软删除）
 * 软删除笔记保留 30 天（5.7.4 定时清理到期彻底删除）；支持恢复 / 立即彻底删除
 */
export default function RecycleBinModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [items, setItems] = useState<RecycleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      setItems(await listRecycleBin());
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRestore = async (item: RecycleItem) => {
    await restoreRecycle(item.id);
    message.success(`已恢复「${item.title}」`);
    await refresh();
    onChanged();
  };

  const handlePurge = async (item: RecycleItem) => {
    await purgeRecycle(item.id);
    message.success(`「${item.title}」已彻底删除（版本/分享等关联一并清除）`);
    await refresh();
    onChanged();
  };

  return (
    <Modal
      open={open}
      title="回收站"
      footer={null}
      onCancel={onClose}
      width={560}
      destroyOnClose
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        删除的笔记保留 30 天，到期由定时任务彻底清除（论文 5.7.3/5.7.4）
      </Typography.Paragraph>
      {items.length === 0 ? (
        <Empty description={loading ? '加载中…' : '回收站是空的'} />
      ) : (
        <List
          size="small"
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  key="restore"
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => void handleRestore(item)}
                >
                  恢复
                </Button>,
                <Popconfirm
                  key="purge"
                  title="彻底删除？"
                  description="版本、分享链接等关联数据将一并清除，不可恢复"
                  okText="彻底删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={() => void handlePurge(item)}
                >
                  <Button danger size="small" icon={<DeleteOutlined />}>
                    彻底删除
                  </Button>
                </Popconfirm>,
              ]}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ maxWidth: 300 }}>
                  {item.title}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  删除于 {new Date(item.deleted_at).toLocaleString('zh-CN')} ·{' '}
                  <Tag color={item.days_remaining <= 3 ? 'red' : 'default'} style={{ marginRight: 0 }}>
                    剩余 {item.days_remaining} 天
                  </Tag>
                </Typography.Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Modal>
  );
}
