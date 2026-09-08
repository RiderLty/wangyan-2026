import { IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/** PATCH /notes/:id —— 全部可选，部分更新；folder_id 传 null 表示移出文件夹 */
export class UpdateNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  folder_id?: string | null;
}
