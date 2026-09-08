import { api } from './client';

/** 文件夹（平铺，前端组装树） */
export interface FolderInfo {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

/** 标签（note_count 供侧栏展示） */
export interface TagInfo {
  id: string;
  name: string;
  color: string | null;
  note_count: number;
}

/** 笔记列表项（不含正文） */
export interface NoteListItem {
  id: string;
  title: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
}

/** 笔记详情（content 为 ProseMirror JSON，论文 2.3.1 JSONB） */
export interface NoteDetail extends NoteListItem {
  owner_id: string;
  team_id: string | null;
  content: Record<string, unknown>;
  content_text: string;
  visibility: string;
}

export interface NoteTagInfo {
  id: string;
  name: string;
  color: string | null;
}

export interface NoteQuery {
  /** 文件夹过滤；"root" = 未归档 */
  folder_id?: string;
  tag_id?: string;
  keyword?: string;
}

// ---------- 文件夹（5.3.3） ----------
export const listFolders = () => api.get<FolderInfo[]>('/folders').then((r) => r.data);
export const createFolder = (data: { name: string; parent_id?: string }) =>
  api.post<FolderInfo>('/folders', data).then((r) => r.data);
export const updateFolder = (id: string, data: { name?: string; parent_id?: string | null }) =>
  api.patch<FolderInfo>(`/folders/${id}`, data).then((r) => r.data);
export const deleteFolder = (id: string) => api.delete(`/folders/${id}`);

// ---------- 标签（5.3.3） ----------
export const listTags = () => api.get<TagInfo[]>('/tags').then((r) => r.data);
export const createTag = (data: { name: string; color?: string }) =>
  api.post<TagInfo>('/tags', data).then((r) => r.data);
export const deleteTag = (id: string) => api.delete(`/tags/${id}`);

// ---------- 笔记（5.3.1 / 5.3.4） ----------
export const listNotes = (query: NoteQuery = {}) =>
  api.get<NoteListItem[]>('/notes', { params: query }).then((r) => r.data);
export const getNote = (id: string) => api.get<NoteDetail>(`/notes/${id}`).then((r) => r.data);
export const createNote = (data: { title?: string; folder_id?: string }) =>
  api.post<NoteDetail>('/notes', data).then((r) => r.data);
export const updateNote = (
  id: string,
  data: { title?: string; content?: Record<string, unknown>; folder_id?: string | null },
) => api.patch<NoteDetail>(`/notes/${id}`, data).then((r) => r.data);
export const deleteNote = (id: string) => api.delete(`/notes/${id}`);

// ---------- 笔记标签 ----------
export const listNoteTags = (id: string) =>
  api.get<NoteTagInfo[]>(`/notes/${id}/tags`).then((r) => r.data);
export const attachNoteTag = (id: string, tag_id: string) =>
  api.put<NoteTagInfo[]>(`/notes/${id}/tags`, { tag_id }).then((r) => r.data);
export const detachNoteTag = (id: string, tagId: string) =>
  api.delete<NoteTagInfo[]>(`/notes/${id}/tags/${tagId}`).then((r) => r.data);
