import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** 父文件夹；缺省为根级 */
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}

/** PATCH /folders/:id —— 重命名 / 移动；parent_id 传 null 移到根级 */
export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  parent_id?: string | null;
}
