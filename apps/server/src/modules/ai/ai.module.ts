import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotesModule } from '../notes/notes.module';
import { ShareModule } from '../share/share.module';
import { Note } from '../notes/note.entity';
import { TeamMember } from '../teams/team-member.entity';
import { LlmGatewayService } from './llm/llm-gateway.service';
import { EditorAiController } from './editor/editor-ai.controller';
import { AgentService } from './agent.service';
import { AgentController } from './agent/agent.controller';
import { AiConversation } from './conversation/ai-conversation.entity';
import { AiMessage } from './conversation/ai-message.entity';
import { NoteAiMeta } from './organize/note-ai-meta.entity';
import { OrganizeService } from './organize/organize.service';
import { OrganizeController } from './organize/organize.controller';

/**
 * AI 智能辅助模块（论文 5.10，v2.0 计划 6.3.1；方向决策 D-014/D-015）
 *
 * - llm/LlmGatewayService：OpenAI 兼容网关，全系统唯一 LLM 出网口（M1）
 * - editor/EditorAiController：编辑器 AI 流式接口（L1，M1）
 * - agent/AgentService + AgentController：Agent 工具调用循环 + 会话持久化
 *   （L4，M2；工具集与 RBAC 收敛见 agent/tools.ts，决策 D-017/D-018）
 * - organize/：L2 智能整理（摘要卡/标签建议/批量整理）+ 会话历史 + 审计（M3）
 * - L3 混合检索（pgvector）随后续里程碑加入
 *
 * 依赖 NotesModule 的 getAccessLevel / TagsService 与 ShareModule 的 assertCanShare：
 * AI 操作与人类操作同权校验（AI 作为第四类权限主体，压轴创新点）
 */
@Module({
  imports: [
    NotesModule,
    ShareModule,
    TypeOrmModule.forFeature([Note, TeamMember, AiConversation, AiMessage, NoteAiMeta]),
  ],
  controllers: [EditorAiController, AgentController, OrganizeController],
  providers: [LlmGatewayService, AgentService, OrganizeService],
  exports: [LlmGatewayService],
})
export class AiModule {}
