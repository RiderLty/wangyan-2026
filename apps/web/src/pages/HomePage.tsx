import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  LogoutOutlined,
  MenuFoldOutlined,
  PlusOutlined,
  TagOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import FolderTreePanel, { type FolderFilter } from '../components/notes/FolderTreePanel';
import NoteListPanel from '../components/notes/NoteListPanel';
import NoteEditorPanel from '../components/notes/NoteEditorPanel';
import TeamManageModal from '../components/teams/TeamManageModal';
import ShareModal from '../components/share/ShareModal';
import VersionDrawer from '../components/notes/VersionDrawer';
import RecycleBinModal from '../components/notes/RecycleBinModal';
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
import {
  acceptInvitation,
  createTeam,
  declineInvitation,
  listMembers,
  listTeamInvitations,
  listTeamNotes,
  listTeams,
  myInvitations,
  type TeamInfo,
  type TeamInvitationInfo,
  type TeamMemberInfo,
} from '../api/teams';

const { Header, Sider, Content } = Layout;

/**
 * 笔记管理工作台（论文 5.3 个人空间 + 5.5 团队空间）
 * 三栏布局：文件夹树/标签/团队/搜索 | 笔记列表 | Tiptap 编辑器（主体）
 * 专注模式：隐藏两侧栏与顶栏，编辑器独占整页（Esc 或按钮退出）
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

  // ---------- 团队状态（5.5） ----------
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitationInfo[]>([]);
  const [createTeamModal, setCreateTeamModal] = useState<{ open: boolean; name: string } | null>(
    null,
  );
  const [manageTeam, setManageTeam] = useState<{ team: TeamInfo } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [teamInvRecords, setTeamInvRecords] = useState<
    { id: string; invitee_email: string; status: string }[]
  >([]);

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

  // ---------- 编辑状态（5.3.1 自动保存；团队笔记可见性 5.5.3） ----------
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
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [versionDrawerOpen, setVersionDrawerOpen] = useState(false);
  const [recycleOpen, setRecycleOpen] = useState(false);
  // 专注模式（5.3.5 布局优化）：编辑器独占整页；Esc 或编辑器头部按钮退出
  const [focusMode, setFocusMode] = useState(false);
  // 左栏收起/展开：顶栏左侧按钮控制（收起时编辑区自适应占满）
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);

  // ---------- 团队数据刷新 ----------
  const refreshTeams = useCallback(async () => {
    setTeams(await listTeams());
  }, []);

  const refreshInvitations = useCallback(async () => {
    setInvitations(await myInvitations());
  }, []);

  useEffect(() => {
    void refreshTeams();
    void refreshInvitations();
  }, [refreshTeams, refreshInvitations]);

  /** 打开团队管理弹窗并拉取成员/邀请记录 */
  const openManageTeam = useCallback(async (team: TeamInfo) => {
    setManageTeam({ team });
    setTeamMembers(await listMembers(team.id));
    setTeamInvRecords(await listTeamInvitations(team.id));
  }, []);

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
      if (selectedTeamId) {
        // 团队空间：RBAC 可见性过滤在服务端完成（5.5.3）
        setNotes(await listTeamNotes(selectedTeamId, kwQuery.trim() || undefined));
      } else {
        const query: Parameters<typeof listNotes>[0] = {};
        if (folderFilter !== 'all') query.folder_id = folderFilter;
        if (activeTag) query.tag_id = activeTag;
        if (kwQuery.trim()) query.keyword = kwQuery.trim();
        setNotes(await listNotes(query));
      }
    } finally {
      setNotesLoading(false);
    }
  }, [selectedTeamId, folderFilter, activeTag, kwQuery]);

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
    const created = selectedTeamId
      ? // 团队新笔记默认团队可编辑（协作场景最常用；可随时调可见性）
        await createNote({ team_id: selectedTeamId, visibility: 'team_edit' })
      : await createNote(
          folderFilter !== 'all' && folderFilter !== 'root' ? { folder_id: folderFilter } : {},
        );
    await refreshNotes();
    await refreshTeams();
    await selectNote(created.id);
  };

  const handleDeleteNote = async (id: string) => {
    if (id === activeIdRef.current) {
      activeIdRef.current = null;
      setActiveNote(null);
      setNoteTags([]);
    }
    try {
      await deleteNote(id);
      message.success('已移入回收站，30 天内可在回收站恢复');
    } catch {
      message.error('删除失败：仅笔记创建者或团队管理员可删除');
    }
    await refreshNotes();
    await refreshTeams();
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

  /** 当前笔记的 RBAC 访问级别（5.5.3）：决定编辑器可编辑性与可见性管理；5.6 分享权限同管理级 */
  const editorAccess = useMemo(() => {
    if (!activeNote) return { editable: false, canManageVisibility: false, canShare: false };
    if (!activeNote.team_id)
      return { editable: true, canManageVisibility: false, canShare: true };
    const team = teams.find((t) => t.id === activeNote.team_id);
    const isNoteOwner = activeNote.owner_id === user?.id;
    const role = team?.my_role;
    const isAdmin = role === 'owner' || role === 'admin';
    const editable = isNoteOwner || isAdmin || activeNote.visibility === 'team_edit';
    return {
      editable,
      canManageVisibility: isNoteOwner || isAdmin,
      canShare: isNoteOwner || isAdmin,
    };
  }, [activeNote, teams, user?.id]);

  /** 团队管理动作 */
  const handleCreateTeam = async () => {
    const name = createTeamModal?.name.trim();
    if (!name) return;
    await createTeam({ name });
    setCreateTeamModal(null);
    message.success('团队已创建');
    await refreshTeams();
  };

  const refreshManageModal = async (teamId: string) => {
    setTeamMembers(await listMembers(teamId));
    setTeamInvRecords(await listTeamInvitations(teamId));
    await refreshTeams();
  };

  const handleAcceptInvitation = async (inv: TeamInvitationInfo) => {
    await acceptInvitation(inv.id);
    message.success(`已加入「${inv.team_name}」`);
    await Promise.all([refreshInvitations(), refreshTeams()]);
  };

  const handleDeclineInvitation = async (inv: TeamInvitationInfo) => {
    await declineInvitation(inv.id);
    await refreshInvitations();
  };

  const contextTitle = selectedTeamId
    ? (teams.find((t) => t.id === selectedTeamId)?.name ?? '团队笔记')
    : folderFilter === 'all'
      ? '全部笔记'
      : folderFilter === 'root'
        ? '未归档'
        : (folders.find((f) => f.id === folderFilter)?.name ?? '笔记');

  return (
    <Layout style={{ height: '100vh' }} className={focusMode ? 'workbench focus-mode' : 'workbench'}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button
            type="text"
            ghost
            className="side-toggle"
            title={siderCollapsed ? '显示侧栏' : '收起侧栏'}
            onClick={() => setSiderCollapsed((v) => !v)}
            icon={
              <MenuFoldOutlined
                className={`side-toggle-icon${siderCollapsed ? ' is-collapsed' : ''}`}
              />
            }
          />
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            在线Markdown笔记编辑与管理平台
          </Typography.Title>
        </div>
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
        {/* 左栏：搜索 + 文件夹树 + 标签（5.3.3 / 5.3.4）——顶栏按钮收起/展开（collapsedWidth=0 完全收回） */}
        <Sider
          width={240}
          collapsedWidth={0}
          collapsed={siderCollapsed}
          trigger={null}
          theme="light"
          className="side-panel"
        >
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
            selected={selectedTeamId ? '' : folderFilter}
            onSelect={(k) => {
              setSelectedTeamId(null);
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
            {tags.map((t) => (
              <Tag.CheckableTag
                key={t.id}
                checked={activeTag === t.id}
                onChange={() => {
                  setSelectedTeamId(null);
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

          {/* 团队（5.5） */}
          <div className="panel-caption" style={{ marginTop: 16 }}>
            团队
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setCreateTeamModal({ open: true, name: '' })}
              title="创建团队"
            />
          </div>
          <div className="team-list">
            {teams.map((t) => (
              <div
                key={t.id}
                className={`team-item${selectedTeamId === t.id ? ' team-item-active' : ''}`}
                onClick={() => {
                  setSelectedTeamId(t.id);
                  setFolderFilter('all');
                  setActiveTag(null);
                }}
              >
                <span className="team-item-name">
                  <TeamOutlined /> {t.name}
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                    {t.note_count}
                  </Typography.Text>
                </span>
                <Button
                  type="text"
                  size="small"
                  icon={<UserAddOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openManageTeam(t);
                  }}
                  title="成员与邀请"
                />
              </div>
            ))}
            {teams.length === 0 && (
              <Typography.Text type="secondary" style={{ fontSize: 12, paddingInline: 4 }}>
                还没有团队，点 + 创建
              </Typography.Text>
            )}
          </div>

          {/* 回收站（5.7.3） */}
          <div className="panel-caption" style={{ marginTop: 16 }}>
            回收站
            <Button
              type="text"
              size="small"
              onClick={() => setRecycleOpen(true)}
              title="打开回收站"
            >
              查看
            </Button>
          </div>

          {/* 收到的邀请（5.5.2） */}
          {invitations.length > 0 && (
            <>
              <div className="panel-caption" style={{ marginTop: 16 }}>
                收到的邀请
              </div>
              <div className="team-list">
                {invitations.map((inv) => (
                  <div key={inv.id} className="team-item invitation-item">
                    <span className="team-item-name" style={{ fontSize: 12 }}>
                      {inv.inviter_name} 邀你加入「{inv.team_name}」
                    </span>
                    <span>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => void handleAcceptInvitation(inv)}
                      >
                        接受
                      </Button>
                      <Button size="small" onClick={() => void handleDeclineInvitation(inv)}>
                        拒绝
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Sider>

        {/* 中栏：笔记列表（5.3.1）——固定列（Content 默认 flex:auto 会伸展抢宽度，必须显式关闭） */}
        <Content
          className="note-list-content"
          style={{
            width: 240,
            flex: 'none',
            // 侧栏收起后列表顶到最左，左边框会变成孤立的"白线"，条件化去掉
            borderInlineStart: siderCollapsed ? 'none' : '1px solid #f0f0f0',
            borderInlineEnd: '1px solid #f0f0f0',
            overflow: 'hidden',
          }}
        >
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
            editable={editorAccess.editable}
            canManageVisibility={editorAccess.canManageVisibility}
            canShare={editorAccess.canShare}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((v) => !v)}
            onShare={() => setShareModalOpen(true)}
            onOpenVersions={() => setVersionDrawerOpen(true)}
            onVisibilityChange={(visibility) => {
              if (!activeNote) return;
              void updateNote(activeNote.id, { visibility }).then(() => {
                message.success('可见性已更新');
                void refreshNotes();
              });
            }}
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

      {/* 创建团队弹窗（5.5.1） */}
      <Modal
        open={!!createTeamModal?.open}
        title="创建团队"
        okText="创建"
        cancelText="取消"
        onOk={() => void handleCreateTeam()}
        onCancel={() => setCreateTeamModal(null)}
        destroyOnClose
      >
        <Input
          placeholder="团队名称"
          maxLength={100}
          prefix={<TeamOutlined />}
          value={createTeamModal?.name}
          onChange={(e) => setCreateTeamModal((m) => (m ? { ...m, name: e.target.value } : m))}
          onPressEnter={() => void handleCreateTeam()}
        />
      </Modal>

      {/* 版本历史抽屉（5.7.1/5.7.2） */}
      {activeNote && (
        <VersionDrawer
          noteId={activeNote.id}
          open={versionDrawerOpen}
          onClose={() => setVersionDrawerOpen(false)}
          onChanged={() => {
            // 回滚后重新拉取正文（title 也可能变化）
            if (activeIdRef.current) void selectNote(activeIdRef.current);
            void refreshNotes();
          }}
        />
      )}

      {/* 回收站弹窗（5.7.3） */}
      <RecycleBinModal
        open={recycleOpen}
        onClose={() => setRecycleOpen(false)}
        onChanged={() => void refreshNotes()}
      />

      {/* 分享链接管理弹窗（5.6） */}
      {activeNote && (
        <ShareModal
          noteId={activeNote.id}
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {/* 团队管理弹窗：成员/角色/邀请（5.5.1 + 5.5.2） */}
      {manageTeam && (
        <TeamManageModal
          team={manageTeam.team}
          members={teamMembers}
          invitationRecords={teamInvRecords}
          myUserId={user?.id ?? ''}
          onClose={() => setManageTeam(null)}
          onChanged={() => {
            void refreshManageModal(manageTeam.team.id);
            if (selectedTeamId === manageTeam.team.id) void refreshNotes();
          }}
        />
      )}
    </Layout>
  );
}
