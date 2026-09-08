import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** GET /notes 查询参数：文件夹过滤 / 标签过滤 / 关键词搜索（5.3.4） */
export class NoteQueryDto {
  /** 文件夹过滤；特殊值 "root" 表示未归档（folder_id IS NULL） */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  folder_id?: string;

  @IsOptional()
  @IsUUID()
  tag_id?: string;

  /** 关键词：标题或正文派生文本的子串匹配（ILIKE） */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
