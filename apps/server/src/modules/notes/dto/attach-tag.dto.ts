import { IsUUID } from 'class-validator';

/** PUT /notes/:id/tags —— 给笔记打标签 */
export class AttachTagDto {
  @IsUUID()
  tag_id: string;
}
