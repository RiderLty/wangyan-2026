import { Module } from '@nestjs/common';
import { NotesModule } from '../notes/notes.module';
import { LlmGatewayService } from './llm/llm-gateway.service';
import { EditorAiController } from './editor/editor-ai.controller';

/**
 * AI 智能辅助模块（论文 5.10，v2.0 计划 6.3.1；方向决策 D-014/D-015）
 *
 * - llm/LlmGatewayService：OpenAI 兼容网关，全系统唯一 LLM 出网口（M1）
 * - editor/EditorAiController：编辑器 AI 流式接口（L1，M1）
 * - agent/（L4 Agent 工具调用，权限收敛）与 task/（L2 摘要/标签批处理）随后续里程碑加入
 *
 * 依赖 NotesModule 的 getAccessLevel（四级访问矩阵）：AI 写入与人工编辑同权校验
 */
@Module({
  imports: [NotesModule],
  controllers: [EditorAiController],
  providers: [LlmGatewayService],
  exports: [LlmGatewayService],
})
export class AiModule {}
