import { useCallback, useEffect, useRef, useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Button,
  Input,
  Layout,
  Modal,
  Popconfirm,
  Tag,
  Typography,
} from 'antd';
import { LogoutOutlined, PlusOutlined, TagOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import FolderTreePanel, { type FolderFilter } from '../components/notes/FolderTreePanel';
import NoteListPanel from '../components/notes/NoteListPanel';
import NoteEditorPanel from '../components/notes/NoteEditorPanel';
import {
  attachNoteTag,
  createFolder,
  createNote,
  createTag,
  deleteFolder,
  deleteNote,
  deleteTag,
  detachNoteTag,
  getNote,
  listFolders,
  listNoteTags,
  listNotes,
  listTags,
  updateFolder,
  updateNote,
  type FolderInfo,
  type NoteDetail,
  type NoteListItem,
  type NoteTagInfo,
  type TagInfo,
} from '../api/notes';

const { Header, Sider, Content } = Layout;

/**
 * 个人笔记管理工作台（论文 5.3 界面）
 * 三栏布局：文件夹树+标签/搜索 | 笔记列表 | Tiptap 编辑器（5.3.1~5.3.4）
 */
export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  // URL 深链：?q=初始搜索词 / ?note=直达笔记（可分享链接）
  const [searchParams] = useSearchParams();

  // ---------- 数据状态 ----------
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // ---------- 过滤状态（5.3.3 分类 / 5.3.4 搜索） ----------
  const [folderFilter, setFolderFilter] = useState<FolderFilter>('all');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(searchParams.get('q') ?? '');
  // 检索词防抖：输入即时回显，400ms 后才触发列表刷新（5.3.4）
  const [kwQuery, setKwQuery] = useState(keyword);
  useEffect(() => {
    const t = setTimeout(() => setKwQuery(keyword), 400);
    return () => clearTimeout(t);
  }, [keyword]);

  // ---------- 编辑状态（5.3.1 自动保存） ----------
  const [activeNote, setActiveNote] = useState<NoteDetail | null>(null);
  const [noteTags, setNoteTags] = useState<NoteTagInfo[]>([]);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');

  // ---------- 弹窗 ----------
  const [folderModal, setFolderModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    parentId?: string;
    folder?: FolderInfo;
    name: string;
  } | null>(null);
  const [tagModal, setTagModal] = useState<{ open: boolean; name: string } | null>(null);

  // 自动保存：800ms 防抖（论文 5.3.1；PATCH /notes/:id）
  const activeIdRef = useRef<string | null>(null);
  const pendingRef = useRef<{ title?: string; content?: Record<string, unknown> }>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFolders = useCallback(async () => {
    setFolders(await listFolders());
  }, []);

  const refreshTags = useCallback(async () => {
    setTags(await listTags());
  }, []);

  const refreshNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const query: Parameters<typeof listNotes>[0] = {};
      if (folderFilter !== 'all') query.folder_id = folderFilter;
      if (activeTag) query.tag_id = activeTag;
      if (kwQuery.trim()) query.keyword = kwQuery.trim();
      setNotes(await listNotes(query));
    } finally {
      setNotesLoading(false);
    }
  }, [folderFilter, activeTag, kwQuery]);

  useEffect(() => {
    void refreshFolders();
    void refreshTags();
  }, [refreshFolders, refreshTags]);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  const flushSave = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = activeIdRef.current;
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (!id || Object.keys(patch).length === 0) return;
    setSaveStatus('saving');
    try {
      await updateNote(id, patch);
      setSaveStatus('saved');
      void refreshNotes();
    } catch {
      setSaveStatus('error');
    }
  }, [refreshNotes]);

  const scheduleSave = (patch: { title?: string }) => {
    // 空标题不落库（服务端 MinLength(1)），界面显示"未命名笔记"占位
    if (patch.title !== undefined && !patch.title.trim()) return;
    pendingRef.current = { ...pendingRef.current, ...patch };
    setSaveStatus('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), 800);
  };

  const selectNote = useCallback(
    async (id: string) => {
      if (id === activeIdRef.current) return;
      await flushSave();
      activeIdRef.current = id;
      setSaveStatus('saved');
      const detail = await getNote(id);
      setActiveNote(detail);
      setNoteTags(await listNoteTags(id));
    },
    [flushSave],
  );

  // 深链 ?note=<id>：挂载后直达指定笔记
  const selectNoteRef = useRef(selectNote);
  selectNoteRef.current = selectNote;
  useEffect(() => {
    const nid = searchParams.get('note');
    if (nid) void selectNoteRef.current(nid);
    // 仅挂载时消费一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNote = async () => {
    await flushSave();
    const created = await createNote(
      folderFilter !== 'all' && folderFilter !== 'root' ? { folder_id: folderFilter } : {},
    );
    await refreshNotes();
    await selectNote(created.id);
  };

  const handleDeleteNote = async (id: string) => {
    if (id === activeIdRef.current) {
      activeIdRef.current = null;
      setActiveNote(null);
      setNoteTags([]);
    }
    await deleteNote(id);
    message.success('已移入回收站（5.7 提供恢复界面）');
    await refreshNotes();
  };

  // ---------- 文件夹操作（5.3.3） ----------
  const openCreateFolder = (parentId?: string) =>
    setFolderModal({ open: true, mode: 'create', parentId, name: '' });

  const openRenameFolder = (folder: FolderInfo) =>
    setFolderModal({ open: true, mode: 'rename', folder, name: folder.name });

  const handleFolderOk = async () => {
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) return;
    if (folderModal.mode === 'create') {
      await createFolder({ name, parent_id: folderModal.parentId });
      message.success('文件夹已创建');
    } else if (folderModal.folder) {
      await updateFolder(folderModal.folder.id, { name });
      message.success('已重命名');
    }
    setFolderModal(null);
    await refreshFolders();
  };

  const handleDeleteFolder = async (folder: FolderInfo) => {
    try {
      await deleteFolder(folder.id);
      message.success('文件夹已删除');
      if (folderFilter === folder.id) setFolderFilter('all');
      await refreshFolders();
    } catch {
      message.error('删除失败：请先清空文件夹内的笔记与子文件夹');
    }
  };

  // ---------- 标签操作（5.3.3） ----------
  const handleCreateTag = async () => {
    if (!tagModal?.name.trim()) return;
    try {
      await createTag({ name: tagModal.name.trim() });
      setTagModal(null);
      await refreshTags();
    } catch {
      message.error('创建失败：标签名可能已存在');
    }
  };

  const handleDeleteTag = async (tag: TagInfo) => {
    await deleteTag(tag.id);
    if (activeTag === tag.id) setActiveTag(null);
    await refreshTags();
  };

  const onLogout = async () => {
    await flushSave();
    await logout();
    navigate('/login');
  };

  const contextTitle =
    folderFilter === 'all'
      ? '全部笔记'
      : folderFilter === 'root'
        ? '未归档'
        : (folders.find((f) => f.id === folderFilter)?.name ?? '笔记');

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 24,
        }}
      >
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          在线Markdown笔记编辑与管理平台
        </Typography.Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar style={{ backgroundColor: '#1677ff' }}>
            {user?.username?.charAt(0)?.toUpperCase()}
          </Avatar>
          <span style={{ color: '#fff' }}>{user?.username}</span>
          <Button ghost size="small" icon={<LogoutOutlined />} onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </Header>

      <Layout>
        {/* 左栏：搜索 + 文件夹树 + 标签（5.3.3 / 5.3.4） */}
        <Sider width={260} theme="light" className="side-panel">
          <Input.Search
            placeholder="搜索笔记标题与正文…"
            allowClear
            enterButton
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <FolderTreePanel
            folders={folders}
            selected={folderFilter}
            onSelect={(k) => {
              setFolderFilter(k);
              setActiveTag(null);
            }}
            onCreate={openCreateFolder}
            onRename={openRenameFolder}
            onDelete={handleDeleteFolder}
          />
          <div className="panel-caption" style={{ marginTop: 16 }}>
            标签
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setTagModal({ open: true, name: '' })}
              title="新建标签"
            />
          </div>
          <div className="tag-cloud">
            {tags.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                还没有标签
              </Typography.Text>
            )}
            {tags.map((t) => (
              <Tag.CheckableTag
                key={t.id}
                checked={activeTag === t.id}
                onChange={() => {
                  setActiveTag(activeTag === t.id ? null : t.id);
                  setFolderFilter('all');
                }}
                style={t.color ? { color: t.color } : undefined}
              >
                <Popconfirm
                  title="删除标签"
                  description="将从所有笔记上移除该标签"
                  okText="删除"
                  cancelText="取消"
                  onConfirm={(e) => {
                    e?.stopPropagation();
                    void handleDeleteTag(t);
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <span onClick={(e) => e.stopPropagation()} className="tag-delete-dot">
                    ×
                  </span>
                </Popconfirm>
                {t.name} ({t.note_count})
              </Tag.CheckableTag>
            ))}
          </div>
        </Sider>

        {/* 中栏：笔记列表（5.3.1） */}
        <Content style={{ width: 260, borderInline: '1px solid #f0f0f0', overflow: 'hidden' }}>
          <NoteListPanel
            notes={notes}
            activeId={activeNote?.id ?? null}
            loading={notesLoading}
            contextTitle={contextTitle}
            onSelect={(id) => void selectNote(id)}
            onCreate={() => void handleCreateNote()}
            onDelete={(id) => void handleDeleteNote(id)}
          />
        </Content>

        {/* 右栏：Tiptap 编辑器（5.3.1 / 5.3.2） */}
        <Content style={{ overflow: 'auto' }}>
          <NoteEditorPanel
            key={activeNote?.id ?? 'empty'}
            note={activeNote}
            noteTags={noteTags}
            allTags={tags}
            saveStatus={saveStatus}
            // 5.4 起正文由 Yjs 协作同步、服务端合并回写；自动保存仅覆盖标题
            onTitleChange={(t) => scheduleSave({ title: t })}
            onAttachTag={(tagId) => {
              if (!activeNote) return;
              void attachNoteTag(activeNote.id, tagId).then((r) => {
                setNoteTags(r);
                void refreshTags();
              });
            }}
            onDetachTag={(tagId) => {
              if (!activeNote) return;
              void detachNoteTag(activeNote.id, tagId).then((r) => {
                setNoteTags(r);
                void refreshTags();
              });
            }}
          />
        </Content>
      </Layout>

      {/* 文件夹新建/重命名弹窗 */}
      <Modal
        open={!!folderModal?.open}
        title={folderModal?.mode === 'create' ? '新建文件夹' : '重命名文件夹'}
        okText="确定"
        cancelText="取消"
        onOk={() => void handleFolderOk()}
        onCancel={() => setFolderModal(null)}
        destroyOnClose
      >
        <Input
          placeholder="文件夹名称"
          maxLength={100}
          value={folderModal?.name}
          onChange={(e) =>
            setFolderModal((m) => (m ? { ...m, name: e.target.value } : m))
          }
          onPressEnter={() => void handleFolderOk()}
        />
      </Modal>

      {/* 标签新建弹窗 */}
      <Modal
        open={!!tagModal?.open}
        title="新建标签"
        okText="确定"
        cancelText="取消"
        onOk={() => void handleCreateTag()}
        onCancel={() => setTagModal(null)}
        destroyOnClose
      >
        <Input
          placeholder="标签名称"
          maxLength={50}
          prefix={<TagOutlined />}
          value={tagModal?.name}
          onChange={(e) => setTagModal((m) => (m ? { ...m, name: e.target.value } : m))}
          onPressEnter={() => void handleCreateTag()}
        />
      </Modal>
    </Layout>
  );
}
