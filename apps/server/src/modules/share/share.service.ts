import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../common/redis.module';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { ShareLink } from './share-link.entity';

/** 分享元数据 Redis 缓存键（database-design.md §7：cache:share:{token}，访客高频访问不打库） */
const SHARE_CACHE_TTL_SECONDS = 60;

interface ShareCacheEntry {
  note_id: string;
  title: string;
  permission: 'read' | 'edit';
  is_enabled: boolean;
  expires_at: string | null;
}

export interface ShareCreateResult {
  id: string;
  token: string;
  permission: 'read' | 'edit';
  expires_at: Date | null;
}

/**
 * 分享服务（论文 5.6 链接生成 / 权限控制 / 有效期管理）
 * 谁能分享：笔记 owner 或团队 owner/admin（分享是扩权动作，普通成员不可）
 */
@Injectable()
export class ShareService {
  constructor(
    @InjectRepository(ShareLink) private readonly shareRepo: Repository<ShareLink>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(TeamMember) private readonly membersRepo: Repository<TeamMember>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private async cacheGet(token: string): Promise<ShareCacheEntry | null> {
    try {
      const raw = await this.redis.get(`cache:share:${token}`);
      return raw ? (JSON.parse(raw) as ShareCacheEntry) : null;
    } catch {
      return null;
    }
  }

  private async cacheSet(token: string, entry: ShareCacheEntry): Promise<void> {
    try {
      await this.redis.set(
        `cache:share:${token}`,
        JSON.stringify(entry),
        'EX',
        SHARE_CACHE_TTL_SECONDS,
      );
    } catch {
      // 缓存失败不影响主流程
    }
  }

  private async cacheInvalidate(token: string): Promise<void> {
    try {
      await this.redis.del(`cache:share:${token}`);
    } catch {
      // 忽略
    }
  }

  /** 分享权限：笔记 owner，或团队笔记的 owner/admin（4.5.4） */
  private async assertCanShare(userId: string, note: Note): Promise<void> {
    if (note.owner_id === userId) return;
    if (note.team_id) {
      const member = await this.membersRepo.findOne({
        where: { team_id: note.team_id, user_id: userId },
        select: ['role'],
      });
      if (member?.role === 'owner' || member?.role === 'admin') return;
    }
    throw new ForbiddenException('只有笔记所有者或团队管理员可以分享');
  }

  private async getNote(noteId: string): Promise<Note> {
    const note = await this.notesRepo.findOne({
      where: { id: noteId, deleted_at: IsNull() },
    });
    if (!note) throw new NotFoundException('笔记不存在');
    return note;
  }

  // ---------- 管理（需登录，论文 5.6.1） ----------

  async create(
    userId: string,
    noteId: string,
    permission: 'read' | 'edit',
    expiresAt: Date | null,
  ): Promise<ShareCreateResult> {
    const note = await this.getNote(noteId);
    await this.assertCanShare(userId, note);
    // token：32 位十六进制（crypto 随机，碰撞概率可忽略，等价 nanoid(32) 语义）
    const token = randomBytes(16).toString('hex');
    const saved = await this.shareRepo.save({
      note_id: noteId,
      token,
      permission,
      expires_at: expiresAt,
      created_by: userId,
    });
    return {
      id: saved.id,
      token: saved.token,
      permission: saved.permission,
      expires_at: saved.expires_at,
    };
  }

  async list(userId: string, noteId: string) {
    const note = await this.getNote(noteId);
    await this.assertCanShare(userId, note);
    return this.shareRepo.find({
      where: { note_id: noteId },
      select: ['id', 'token', 'permission', 'is_enabled', 'expires_at', 'visit_count', 'created_at'],
      order: { created_at: 'DESC' },
    });
  }

  /** 启停 / 改权限 / 改有效期（5.6.3），变更后失效缓存 */
  async update(
    userId: string,
    linkId: string,
    patch: { is_enabled?: boolean; permission?: 'read' | 'edit'; expires_at?: Date | null },
  ) {
    const link = await this.shareRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('分享链接不存在');
    const note = await this.getNote(link.note_id);
    await this.assertCanShare(userId, note);
    if (patch.is_enabled !== undefined) link.is_enabled = patch.is_enabled;
    if (patch.permission !== undefined) link.permission = patch.permission;
    if ('expires_at' in patch) link.expires_at = patch.expires_at ?? null;
    const saved = await this.shareRepo.save(link);
    await this.cacheInvalidate(link.token);
    return {
      id: saved.id,
      token: saved.token,
      permission: saved.permission,
      is_enabled: saved.is_enabled,
      expires_at: saved.expires_at,
    };
  }

  async remove(userId: string, linkId: string): Promise<void> {
    const link = await this.shareRepo.findOne({ where: { id: linkId } });
    if (!link) throw new NotFoundException('分享链接不存在');
    const note = await this.getNote(link.note_id);
    await this.assertCanShare(userId, note);
    await this.shareRepo.delete(linkId);
    await this.cacheInvalidate(link.token);
  }

  // ---------- 公开解析（无需登录，论文 5.6.2） ----------

  /**
   * 按 token 解析分享：有效返回快照元数据；失效/停用/过期/笔记已删 → 404（不区分原因，防枚举）
   * 元数据走 Redis 60s 缓存；visit_count 每次访问直接 +1（不缓存，演示可见）
   */
  async resolveByToken(token: string) {
    let entry = await this.cacheGet(token);
    if (!entry) {
      const link = await this.shareRepo.findOne({ where: { token } });
      if (!link) throw new NotFoundException('分享链接不存在或已失效');
      const note = await this.notesRepo.findOne({
        where: { id: link.note_id, deleted_at: IsNull() },
        select: ['id', 'title'],
      });
      if (!note) throw new NotFoundException('分享链接不存在或已失效');
      entry = {
        note_id: note.id,
        title: note.title,
        permission: link.permission,
        is_enabled: link.is_enabled,
        expires_at: link.expires_at ? link.expires_at.toISOString() : null,
      };
      await this.cacheSet(token, entry);
    }
    if (!entry.is_enabled) throw new NotFoundException('分享链接不存在或已失效');
    if (entry.expires_at && new Date(entry.expires_at).getTime() < Date.now()) {
      throw new NotFoundException('分享链接不存在或已失效');
    }
    return entry;
  }

  /** 公开页取正文快照（编辑权限访客进入协作前的初始渲染） */
  async getSharedContent(noteId: string) {
    const note = await this.notesRepo.findOne({
      where: { id: noteId, deleted_at: IsNull() },
      select: ['id', 'title', 'content'],
    });
    if (!note) throw new NotFoundException('分享链接不存在或已失效');
    await this.shareRepo.increment({ note_id: noteId }, 'visit_count', 1);
    return { title: note.title, content: note.content };
  }

  /** WS 访客鉴权（论文 4.5.4 + 5.6.2）：token 有效且 permission=edit */
  async assertShareEdit(token: string): Promise<string | null> {
    try {
      const entry = await this.resolveByToken(token);
      if (entry.permission === 'edit') return entry.note_id;
      return null;
    } catch {
      return null;
    }
  }
}
