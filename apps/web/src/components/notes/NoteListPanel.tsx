import { Button, Empty, List, Popconfirm, Spin, Typography } from 'antd';
import { DeleteOutlined, FileAddOutlined } from '@ant-design/icons';
import type { NoteListItem } from '../../api/notes';

/** 笔记列表面板（论文 5.3.1） */
interface Props {
  notes: NoteListItem[];
  activeId: string | null;
  loading: boolean;
  contextTitle: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `今天 ${d.toTimeString().slice(0, 5)}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NoteListPanel({
  notes,
  activeId,
  loading,
  contextTitle,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <div className="note-list-panel">
      <div className="panel-caption">
        <Typography.Text strong ellipsis style={{ maxWidth: 150 }}>
          {contextTitle}
        </Typography.Text>
        <Button type="text" size="small" icon={<FileAddOutlined />} onClick={onCreate}>
          新笔记
        </Button>
      </div>
      <div className="note-list-scroll">
        {loading ? (
          <div className="note-list-loading">
            <Spin />
          </div>
        ) : notes.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ fontSize: 12 }}>这里还没有笔记，点"新笔记"创建</span>}
          />
        ) : (
          <List
            size="small"
            dataSource={notes}
            renderItem={(item) => (
              <List.Item
                className={`note-item${item.id === activeId ? ' note-item-active' : ''}`}
                onClick={() => onSelect(item.id)}
                actions={
                  item.id === activeId
                    ? [
                        <Popconfirm
                          key="del"
                          title="删除笔记"
                          description="将移入回收站（保留 30 天）"
                          okText="删除"
                          cancelText="取消"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            onDelete(item.id);
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>,
                      ]
                    : undefined
                }
              >
                <div className="note-item-body">
                  <Typography.Text strong ellipsis style={{ maxWidth: 170 }}>
                    {item.title}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {formatTime(item.updated_at)}
                  </Typography.Text>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
}
