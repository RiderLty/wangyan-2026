import { api } from './client';

/** 版本（论文 4.3.6 note_versions） */
export interface VersionInfo {
  version_no: number;
  title: string;
  source: 'manual' | 'auto' | 'rollback';
  created_by: string;
  created_at: string;
}

export interface VersionDetail extends VersionInfo {
  content: Record<string, unknown>;
}

export const listVersions = (noteId: string) =>
  api.get<VersionInfo[]>(`/notes/${noteId}/versions`).then((r) => r.data);

export const getVersion = (noteId: string, versionNo: number) =>
  api.get<VersionDetail>(`/notes/${noteId}/versions/${versionNo}`).then((r) => r.data);

export const saveVersion = (noteId: string) =>
  api.post(`/notes/${noteId}/versions`).then((r) => r.data);

export const rollbackVersion = (noteId: string, versionNo: number) =>
  api.post(`/notes/${noteId}/versions/rollback`, { version_no: versionNo }).then((r) => r.data);

/** 回收站（论文 4.3.8 recycle_bin） */
export interface RecycleItem {
  id: string;
  note_id: string;
  title: string;
  deleted_at: string;
  expires_at: string;
  days_remaining: number;
}

export const listRecycleBin = () => api.get<RecycleItem[]>('/recycle-bin').then((r) => r.data);

export const restoreRecycle = (id: string) =>
  api.post<{ note_id: string }>(`/recycle-bin/${id}/restore`).then((r) => r.data);

export const purgeRecycle = (id: string) => api.delete(`/recycle-bin/${id}`);
