import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Note } from './note.entity';
import { Tag } from './tag.entity';

/**
 * 笔记-标签关联表实体（database-design.md §3.8）
 * 复合主键 (note_id, tag_id) 天然防重复打标；外键均 ON DELETE CASCADE
 */
@Entity('note_tags')
@Index('idx_note_tags_tag', ['tag_id'])
export class NoteTag {
  @PrimaryColumn({ type: 'uuid', name: 'note_id' })
  note_id: string;

  @PrimaryColumn({ type: 'uuid', name: 'tag_id' })
  tag_id: string;

  @ManyToOne(() => Note, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;
}
