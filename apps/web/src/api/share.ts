import { api } from './client';

/** 分享链接（管理视角，论文 4.3.7 share_links） */
export interface ShareLinkInfo {
  id: string;
  token: string;
  permission: 'read' | 'edit';
  is_enabled: boolean;
  expires_at: string | null;
  visit_count: number;
  created_at: string;
}

export type SharePermission = 'read' | 'edit';

// ---------- 管理（需登录，5.6.1/5.6.3） ----------
export const createShare = (data: {
  note_id: string;
  permission: SharePermission;
  expires_at?: string | null;
}) => api.post<ShareLinkInfo>('/share', data).then((r) => r.data);

export const listShares = (noteId: string) =>
  api.get<ShareLinkInfo[]>('/share', { params: { note_id: noteId } }).then((r) => r.data);

export const setShareEnabled = (id: string, is_enabled: boolean) =>
  api.patch(`/share/${id}/enabled`, { is_enabled });

export const updateShare = (
  id: string,
  data: { permission?: SharePermission; expires_at?: string | null },
) => api.patch<ShareLinkInfo>(`/share/${id}`, data);

export const deleteShare = (id: string) => api.delete(`/share/${id}`);

// ---------- 公开（无需登录，5.6.2） ----------
export interface ShareMeta {
  note_id: string;
  title: string;
  permission: SharePermission;
  is_enabled: boolean;
  expires_at: string | null;
}

export interface ShareContent {
  title: string;
  content: Record<string, unknown>;
}

export const resolveShare = (token: string) =>
  api.get<ShareMeta>(`/public/share/${token}`).then((r) => r.data);

export const shareContent = (token: string) =>
  api.get<ShareContent>(`/public/share/${token}/content`).then((r) => r.data);
