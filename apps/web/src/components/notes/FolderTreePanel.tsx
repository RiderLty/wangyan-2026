import { Button, Dropdown, Empty, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { FolderOutlined, FolderAddOutlined, MoreOutlined } from '@ant-design/icons';
import type { FolderInfo } from '../../api/notes';

/**
 * 文件夹树面板（论文 5.3.3 笔记分类与文件夹管理）
 * 服务端返回平铺列表，这里组装成嵌套树；节点悬浮出现 ⋯ 菜单（新建子文件夹/重命名/删除）
 */

export type FolderFilter = 'all' | 'root' | string; // all=全部笔记 root=未归档 其余=文件夹ID

interface Props {
  folders: FolderInfo[];
  selected: FolderFilter;
  onSelect: (key: FolderFilter) => void;
  onCreate: (parentId?: string) => void;
  onRename: (folder: FolderInfo) => void;
  onDelete: (folder: FolderInfo) => void;
}

export default function FolderTreePanel({
  folders,
  selected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const menuFor = (folder: FolderInfo) => ({
    items: [
      { key: 'create', icon: <FolderAddOutlined />, label: '新建子文件夹' },
      { key: 'rename', label: '重命名' },
      { key: 'delete', danger: true, label: '删除文件夹' },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'create') onCreate(folder.id);
      if (key === 'rename') onRename(folder);
      if (key === 'delete') onDelete(folder);
    },
  });

  const buildNodes = (parentId: string | null): DataNode[] =>
    folders
      .filter((f) => f.parent_id === parentId)
      .map((f) => ({
        key: f.id,
        title: (
          <span className="folder-node">
            <span className="folder-node-name">
              <FolderOutlined /> {f.name}
            </span>
            <Dropdown menu={menuFor(f)} trigger={['click']}>
              <Button
                type="text"
                size="small"
                className="folder-node-more"
                icon={<MoreOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          </span>
        ),
        children: buildNodes(f.id),
      }));

  const treeData: DataNode[] = [
    { key: 'all', title: '全部笔记' },
    { key: 'root', title: '未归档' },
    ...buildNodes(null),
  ];

  return (
    <div className="folder-panel">
      <div className="panel-caption">
        文件夹
        <Button
          type="text"
          size="small"
          icon={<FolderAddOutlined />}
          onClick={() => onCreate(undefined)}
          title="新建根文件夹"
        />
      </div>
      {folders.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ fontSize: 12 }}>还没有文件夹，点右上角 + 新建</span>}
        />
      ) : (
        <Tree
          blockNode
          showLine={false}
          selectedKeys={[selected]}
          defaultExpandAll
          treeData={treeData}
          onSelect={(keys) => {
            if (keys.length) onSelect(keys[0] as FolderFilter);
          }}
        />
      )}
    </div>
  );
}
