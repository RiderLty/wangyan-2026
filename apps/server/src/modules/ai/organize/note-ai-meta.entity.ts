import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * 笔记 AI 派生数据（论文 5.10 L2 智能整理）：摘要卡 + 标签建议。
 * 与 notes 表分离——AI 生成内容属于可再生的派生数据，不污染 v1 核心表（4.3）。
 */
@Entity('note_ai_meta')
export class NoteAiMeta {
  /** 一篇笔记一行（外键 notes.id，级联删除） */
  @PrimaryColumn({ type: 'uuid' })
  note_id: string;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  /** 标签建议（LLM 生成，用户一键采纳后转正为真实标签） */
  @Column({ type: 'jsonb', nullable: true })
  suggested_tags: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  organized_at: Date;
}
