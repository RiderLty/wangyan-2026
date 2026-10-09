import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

/**
 * L3 混合检索接口（论文 5.10，v2.0 计划 M4）
 * 全部需登录；检索范围与 Agent 工具同口径（个人 + 所在团队可读笔记）。
 */
class ReindexDto {
  @IsUUID()
  note_id!: string;
}

class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question!: string;
}

@Controller('ai/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** POST /ai/search/reindex —— 单篇重索引（切片 + 向量化） */
  @Post('reindex')
  reindex(@Request() req: { user: { id: string } }, @Body() dto: ReindexDto) {
    return this.searchService.reindexNote(req.user.id, dto.note_id);
  }

  /** POST /ai/search/reindex-all —— 全量补齐索引（≤20 篇/轮） */
  @Post('reindex-all')
  reindexAll(@Request() req: { user: { id: string } }) {
    return this.searchService.reindexAll(req.user.id);
  }

  /** GET /ai/search?q= —— 混合检索（关键词 ILIKE ∪ 向量语义，RRF 融合） */
  @Get()
  search(@Request() req: { user: { id: string } }, @Query('q') q?: string) {
    return this.searchService.hybridSearch(req.user.id, q ?? '');
  }

  /** POST /ai/search/ask —— RAG 问答（检索结果喂 LLM，带 [n] 出处） */
  @Post('ask')
  ask(@Request() req: { user: { id: string } }, @Body() dto: AskDto) {
    return this.searchService.ask(req.user.id, dto.question);
  }
}
