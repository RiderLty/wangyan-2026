import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * AI 对话消息（论文 5.10.3）：role ∈ user/assistant/tool。
 * assistant 消息可携带 tool_calls（发起的工具调用）；tool 消息以 tool_call_id 回填执行结果。
 * model/tokens 记录用量（DeepSeek usage，含缓存命中——审计页 M3 展示）。
 */
@Entity('ai_messages')
@Index(['conversation_id', 'created_at'])
export class AiMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 12 })
  role: 'user' | 'assistant' | 'tool';

  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** assistant 消息携带的工具调用（OpenAI tool_calls 原始结构） */
  @Column({ type: 'jsonb', nullable: true })
  tool_calls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> | null;

  /** tool 消息对应的调用 id */
  @Column({ type: 'varchar', length: 64, nullable: true })
  tool_call_id: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  tokens: number | null;

  @CreateDateColumn()
  created_at: Date;
}
