import { Note } from '../../notes/note.entity';
import { TeamMember } from '../../teams/team-member.entity';
import { NotesService } from '../../notes/notes.service';
import { ShareService } from '../../share/share.service';
import { markdownToNoteContent } from './markdown-to-prosemirror';

/**
 * Agent 工具注册表（论文 5.10.3 / v2.0 计划 6.3.4，压轴创新点：AI 主体纳入 RBAC）
 *
 * 收敛规则（论文可写成一小节设计）：
 * 1. 工具以"当前对话用户"身份执行——Agent 无独立身份，不拥有任何数据；
 * 2. 每次执行前经过与 REST/WS 完全相同的权限矩阵（getAccessLevel / assertCanShare），
 *    越权以错误结果回填模型（让模型知错改道，而非静默失败）；
 * 3. M2 工具集刻意不含破坏性操作（删除/停用链接）——破坏性工具需二次确认机制，见 DECISIONS；
 * 4. 全部调用经 agent.service 落 ai_messages 审计（谁、何时、参数、结果）。
 */

export interface AgentToolContext {
  userId: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
  execute(ctx: AgentToolContext, args: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/** LIKE 通配符转义（与 notes.service 同口径） */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function buildAgentTools(deps: {
  notesService: NotesService;
  shareService: ShareService;
  noteRepo: { manager: unknown } & Record<string, any>; // Repository<Note>
  memberRepo: { manager: unknown } & Record<string, any>; // Repository<TeamMember>
}): AgentTool[] {
  const { notesService, shareService, noteRepo, memberRepo } = deps;

  const searchNotes: AgentTool = {
    name: 'search_notes',
    description: '按关键词搜索当前用户有权访问的笔记（个人笔记 + 其所在团队的可读笔记），返回标题与 id。',
    parameters: {
      type: 'object',
      properties: { keyword: { type: 'string', description: '关键词（匹配标题或正文，2~30 字效果最好）' } },
      required: ['keyword'],
    },
    async execute({ userId }, args) {
      const keyword = String(args.keyword ?? '').trim();
      if (!keyword) throw new Error('关键词不能为空');
      const kw = `%${escapeLike(keyword)}%`;
      // 个人笔记（owner，无团队）
      const personal = await noteRepo
        .createQueryBuilder('n')
        .where('n.owner_id = :userId', { userId })
        .andWhere('n.team_id IS NULL')
        .andWhere('n.deleted_at IS NULL')
        .andWhere('(n.title ILIKE :kw OR n.content_text ILIKE :kw)', { kw })
        .select(['n.id', 'n.title', 'n.updated_at'])
        .limit(8)
        .getMany();
      // 团队笔记（成员 且 owner/可读/可编辑）
      const membership = await memberRepo.find({ where: { user_id: userId }, select: ['team_id'] });
      const teamIds = membership.map((m: TeamMember) => m.team_id);
      const teamNotes = teamIds.length
        ? await noteRepo
            .createQueryBuilder('n')
            .where('n.team_id IN (:...teamIds)', { teamIds })
            .andWhere('n.deleted_at IS NULL')
            .andWhere('(n.owner_id = :userId OR n.visibility IN (:...vis))', {
              userId,
              vis: ['team_read', 'team_edit'],
            })
            .andWhere('(n.title ILIKE :kw OR n.content_text ILIKE :kw)', { kw })
            .select(['n.id', 'n.title', 'n.updated_at'])
            .limit(8)
            .getMany()
        : [];
      const seen = new Set<string>();
      const notes = [...personal, ...teamNotes]
        .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
        .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
        .slice(0, 8)
        .map((n) => ({ id: n.id, title: n.title, updated_at: n.updated_at.toISOString() }));
      return { total: notes.length, notes };
    },
  };

  const getNote: AgentTool = {
    name: 'get_note',
    description: '读取一篇笔记的标题与纯文本正文（用于引用其内容写作或回答问题）。须为当前用户有权访问的笔记。',
    parameters: {
      type: 'object',
      properties: { note_id: { type: 'string', description: '笔记 id（来自 search_notes）' } },
      required: ['note_id'],
    },
    async execute({ userId }, args) {
      const { note } = await notesService.getAccessLevel(userId, String(args.note_id ?? ''));
      return {
        id: note.id,
        title: note.title,
        updated_at: note.updated_at.toISOString(),
        content_text: (note.content_text ?? '').slice(0, 3000),
      };
    },
  };

  const createNote: AgentTool = {
    name: 'create_note',
    description: '创建一篇新笔记，正文用 Markdown 书写（支持标题/列表/表格/代码块）。个人空间或指定团队。',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '笔记标题（≤200 字）' },
        content_markdown: { type: 'string', description: '正文 Markdown 文本' },
        team_id: { type: 'string', description: '可选：创建为该团队的笔记（须为团队成员）' },
      },
      required: ['title', 'content_markdown'],
    },
    async execute({ userId }, args) {
      const title = String(args.title ?? '').trim() || '未命名笔记';
      const md = String(args.content_markdown ?? '');
      const { content } = markdownToNoteContent(md);
      const teamId = args.team_id ? String(args.team_id) : undefined;
      const note = await notesService.create(userId, {
        title,
        content: content as Record<string, unknown>,
        ...(teamId ? { team_id: teamId, visibility: 'team_edit' as const } : {}),
      });
      return { id: note.id, title: note.title };
    },
  };

  const updateNote: AgentTool = {
    name: 'update_note',
    description: '用新的 Markdown 正文整体替换一篇笔记的内容（须有编辑权；如需保留原文请先 get_note 取回摘录）。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '笔记 id' },
        content_markdown: { type: 'string', description: '替换后的完整正文 Markdown' },
      },
      required: ['note_id', 'content_markdown'],
    },
    async execute({ userId }, args) {
      const noteId = String(args.note_id ?? '');
      const md = String(args.content_markdown ?? '');
      const { content } = markdownToNoteContent(md);
      // notesService.update 内部执行 team_read 拒绝等权限校验（4.5.2 矩阵复用）
      const saved = await notesService.update(userId, noteId, { content: content as Record<string, unknown> });
      return { id: saved.id, title: saved.title, updated: true };
    },
  };

  const createShareLink: AgentTool = {
    name: 'create_share_link',
    description: '为一篇笔记生成访客分享链接（须有分享权限）。可设置有效期天数，不填为永久。',
    parameters: {
      type: 'object',
      properties: {
        note_id: { type: 'string', description: '笔记 id' },
        permission: { type: 'string', description: '访客权限', enum: ['read', 'edit'] },
        expires_in_days: { type: 'string', description: '可选：有效天数（数字字符串，如 7）；不填为永久' },
      },
      required: ['note_id', 'permission'],
    },
    async execute({ userId }, args) {
      const noteId = String(args.note_id ?? '');
      const permission = args.permission === 'edit' ? 'edit' : 'read';
      const days = Number(args.expires_in_days);
      const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400_000) : null;
      // shareService.create 内部执行 assertCanShare（owner/团队管理员）权限校验（5.6.1 复用）
      const result = await shareService.create(userId, noteId, permission, expiresAt);
      return {
        id: result.id,
        token: result.token,
        path: `/share/${result.token}`,
        permission: result.permission,
        expires_at: result.expires_at?.toISOString() ?? null,
      };
    },
  };

  return [searchNotes, getNote, createNote, updateNote, createShareLink];
}
