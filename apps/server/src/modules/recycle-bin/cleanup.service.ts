import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LessThan, Repository } from 'typeorm';
import { RecycleBin } from '../notes/recycle-bin.entity';
import { Note } from '../notes/note.entity';
import { TeamInvitation } from '../teams/team-invitation.entity';

/**
 * 定时清理服务（论文 5.7.4）
 * 每小时 + 启动时扫描：
 * 1. 回收站到期（删除 +30 天）→ 彻底删除笔记（外键级联清版本/分享/增量）
 * 2. 过期团队邀请 → status 置 expired
 */
@Injectable()
export class CleanupService implements OnModuleInit {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectRepository(RecycleBin) private readonly recycleRepo: Repository<RecycleBin>,
    @InjectRepository(Note) private readonly notesRepo: Repository<Note>,
    @InjectRepository(TeamInvitation) private readonly invitationsRepo: Repository<TeamInvitation>,
  ) {}

  /** 启动时先扫一遍（开发演示不必等整点） */
  async onModuleInit(): Promise<void> {
    await this.cleanup();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    await this.cleanup();
  }

  async cleanup(): Promise<{ purged_notes: number; expired_invitations: number }> {
    // 1. 回收站到期彻底清除
    const expired = await this.recycleRepo.find({
      where: { expires_at: LessThan(new Date()) },
      select: ['id', 'note_id'],
    });
    for (const row of expired) {
      // 删 notes 行：note_versions/share_links/note_tags/yjs_updates/recycle_bin 经外键级联
      await this.notesRepo.delete(row.note_id);
    }
    // 2. 过期邀请标记
    const inv = await this.invitationsRepo.update(
      { status: 'pending', expires_at: LessThan(new Date()) },
      { status: 'expired' },
    );
    if (expired.length || inv.affected) {
      this.logger.log(
        `[定时清理] 彻底删除过期回收笔记 ${expired.length} 篇，标记过期邀请 ${inv.affected ?? 0} 条`,
      );
    }
    return { purged_notes: expired.length, expired_invitations: inv.affected ?? 0 };
  }
}
