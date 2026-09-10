import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  App as AntdApp,
  Button,
  Drawer,
  Empty,
  List,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { HistoryOutlined, SaveOutlined } from '@ant-design/icons';
import {
  getVersion,
  listVersions,
  rollbackVersion,
  saveVersion,
  type VersionDetail,
  type VersionInfo,
} from '../../api/history';

/**
 * 版本历史抽屉（论文 5.7.1 版本历史 / 5.7.2 回滚与恢复）
 * 列表（来源标签：手动/自动/回滚前）+ 只读预览 + 手动保存 + 回滚（回滚前自动快照）
 */
export default function VersionDrawer({
  noteId,
  open,
  onClose,
  onChanged,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [selected, setSelected] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const list = await listVersions(noteId);
      setVersions(list);
      if (list.length) {
        setSelected(await getVersion(noteId, list[0].version_no));
      } else {
        setSelected(null);
      }
    } finally {
      setLoading(false);
    }
  }, [open, noteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sourceTag = (source: VersionInfo['source']) =>
    source === 'manual' ? (
      <Tag color="blue">手动</Tag>
    ) : source === 'auto' ? (
      <Tag color="green">自动</Tag>
    ) : (
      <Tag color="orange">回滚前</Tag>
    );

  const handleSave = async () => {
    await saveVersion(noteId);
    message.success('已保存当前版本');
    await refresh();
  };

  const handleRollback = async () => {
    if (!selected) return;
    await rollbackVersion(noteId, selected.version_no);
    message.success(`已回滚到版本 ${selected.version_no}（回滚前状态已自动存为版本）`);
    onChanged();
    await refresh();
  };

  return (
    <Drawer
      title={
        <Space>
          <HistoryOutlined /> 版本历史
          <Button size="small" icon={<SaveOutlined />} onClick={() => void handleSave()}>
            保存当前为版本
          </Button>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <Empty description="还没有版本：编辑停顿自动保存于会话结束，或点上方按钮手动保存" />
        ) : (
          <div style={{ display: 'flex', gap: 16 }}>
            {/* 版本列表 */}
            <div style={{ width: 260, flexShrink: 0 }}>
              <List
                size="small"
                dataSource={versions}
                renderItem={(v) => (
                  <List.Item
                    className={selected?.version_no === v.version_no ? 'note-item-active' : ''}
                    style={{
                      cursor: 'pointer',
                      borderRadius: 6,
                      paddingInline: 8,
                      background: selected?.version_no === v.version_no ? '#e6f4ff' : undefined,
                    }}
                    onClick={() => {
                      void getVersion(noteId, v.version_no).then(setSelected);
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Space size={6}>
                        <Typography.Text strong>v{v.version_no}</Typography.Text>
                        {sourceTag(v.source)}
                      </Space>
                      <Typography.Text type="secondary" ellipsis style={{ maxWidth: 190, fontSize: 12 }}>
                        {v.title}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(v.created_at).toLocaleString('zh-CN')}
                      </Typography.Text>
                    </div>
                  </List.Item>
                )}
              />
            </div>

            {/* 预览 + 回滚 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {selected ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Typography.Text strong>版本 {selected.version_no} 预览</Typography.Text>
                    <Popconfirm
                      title="回滚到此版本？"
                      description="当前内容会自动保存为「回滚前」版本，协作中的成员将实时看到回滚"
                      okText="回滚"
                      cancelText="取消"
                      onConfirm={() => void handleRollback()}
                    >
                      <Button danger size="small">
                        回滚到此版本
                      </Button>
                    </Popconfirm>
                  </div>
                  <div className="version-preview">
                    <VersionPreview key={selected.version_no} content={selected.content} />
                  </div>
                </>
              ) : (
                <Empty description="选择左侧版本预览" />
              )}
            </div>
          </div>
        )}
    </Drawer>
  );
}

/** 版本只读预览（REST 快照渲染） */
function VersionPreview({ content }: { content: Record<string, unknown> }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content as never,
    editable: false,
  });
  return <EditorContent editor={editor} className="editor-content version-preview-content" />;
}
