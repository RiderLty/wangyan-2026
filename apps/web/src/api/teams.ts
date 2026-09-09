import { api } from './client';

export type TeamRole = 'owner' | 'admin' | 'member';

/** 我的团队（列表项，含 RBAC 角色与统计） */
export interface TeamInfo {
  id: string;
  name: string;
  description: string | null;
  my_role: TeamRole;
  is_owner: boolean;
  member_count: number;
  note_count: number;
}

export interface TeamMemberInfo {
  user_id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  role: TeamRole;
  joined_at: string;
}

/** 我收到的待处理邀请 */
export interface TeamInvitationInfo {
  id: string;
  team_name: string;
  invitee_email: string;
  inviter_name: string;
  expires_at: string;
}

/** 团队邀请记录（管理视角） */
export interface TeamInvitationRecord {
  id: string;
  invitee_email: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
}

/** 团队笔记列表项（比个人列表多 visibility/owner_id） */
export interface TeamNoteListItem {
  id: string;
  title: string;
  visibility: 'private' | 'team_read' | 'team_edit';
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// ---------- 团队 CRUD（5.5.1） ----------
export const listTeams = () => api.get<TeamInfo[]>('/teams').then((r) => r.data);
export const createTeam = (data: { name: string; description?: string }) =>
  api.post<TeamInfo>('/teams', data).then((r) => r.data);
export const deleteTeam = (id: string) => api.delete(`/teams/${id}`);

// ---------- 成员（5.5.1） ----------
export const listMembers = (teamId: string) =>
  api.get<TeamMemberInfo[]>(`/teams/${teamId}/members`).then((r) => r.data);
export const setMemberRole = (teamId: string, userId: string, role: 'admin' | 'member') =>
  api.patch(`/teams/${teamId}/members/${userId}`, { role });
export const removeMember = (teamId: string, userId: string) =>
  api.delete(`/teams/${teamId}/members/${userId}`);

// ---------- 邀请（5.5.2） ----------
export const inviteMember = (teamId: string, email: string) =>
  api.post(`/teams/${teamId}/invitations`, { email }).then((r) => r.data);
export const listTeamInvitations = (teamId: string) =>
  api.get<TeamInvitationRecord[]>(`/teams/${teamId}/invitations`).then((r) => r.data);
export const cancelInvitation = (teamId: string, invitationId: string) =>
  api.post(`/teams/${teamId}/invitations/${invitationId}/cancel`);
export const myInvitations = () =>
  api.get<TeamInvitationInfo[]>('/teams/invitations/mine').then((r) => r.data);
export const acceptInvitation = (invitationId: string) =>
  api.post<{ team_id: string }>(`/teams/invitations/${invitationId}/accept`).then((r) => r.data);
export const declineInvitation = (invitationId: string) =>
  api.post(`/teams/invitations/${invitationId}/decline`);

// ---------- 团队笔记（5.5.3） ----------
export const listTeamNotes = (teamId: string, keyword?: string) =>
  api
    .get<TeamNoteListItem[]>(`/teams/${teamId}/notes`, { params: keyword ? { keyword } : {} })
    .then((r) => r.data);
