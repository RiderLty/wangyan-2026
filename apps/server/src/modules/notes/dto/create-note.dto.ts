import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** POST /notes（论文 4.6.2 笔记管理接口；团队笔记在 5.5 扩展） */
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

  /** 归属文件夹；缺省为未归档（团队笔记必须为空，CHECK 约束兜底） */
  @IsOptional()
  @IsUUID()
  folder_id?: string;

  /** 传团队 id 创建团队笔记（须为团队成员，5.5.3） */
  @IsOptional()
  @IsUUID()
  team_id?: string;

  /** 团队笔记的成员级权限（4.5.2）：私有/团队可读/团队可编辑 */
  @IsOptional()
  @IsIn(['private', 'team_read', 'team_edit'])
  visibility?: 'private' | 'team_read' | 'team_edit';
}
