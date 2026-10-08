import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * AI 对话会话（论文 5.10.3，v2.0 计划 6.3.6）
 * 绑定用户；可选绑定笔记（编辑器助手上下文）。DDL 定稿后导出附录 A。
 */
@Entity('ai_conversations')
@Index(['user_id'])
export class AiConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  /** 关联笔记（编辑器内发起的助手对话），可空 */
  @Column({ type: 'uuid', nullable: true })
  note_id: string | null;

  /** 会话标题（取首条消息前 30 字） */
  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
