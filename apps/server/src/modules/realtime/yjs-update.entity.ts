import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Note } from '../notes/note.entity';

/**
 * Yjs CRDT 增量表实体（database-design.md §3.10 / 论文 4.4.2，支撑 5.4）
 *
 * 追加式存储每帧二进制增量（bytea）；id 自增保证回放顺序。
 * 编辑会话结束（末个连接断开）时由持久化适配器合并回写 notes.content 快照，
 * 并清理已合并的增量行（compaction，见 collaboration.persistence.ts）。
 */
@Entity('yjs_updates')
@Index('idx_yjs_note', ['note_id', 'id'])
export class YjsUpdate {
  /** bigserial：自增保证追加顺序（pg 驱动返回 string） */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'uuid' })
  note_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note | null;

  /** Yjs 二进制增量（Uint8Array → bytea） */
  @Column({ type: 'bytea' })
  update: Buffer;

  @CreateDateColumn()
  created_at: Date;
}
