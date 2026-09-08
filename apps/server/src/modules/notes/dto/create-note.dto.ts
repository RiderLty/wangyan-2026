import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** POST /notes（论文 4.6.2 笔记管理接口） */
export class CreateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  /** 初始正文：ProseMirror 文档 JSON；缺省为空文档 */
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  /** 归属文件夹；缺省为未归档 */
  @IsOptional()
  @IsUUID()
  folder_id?: string;
}
