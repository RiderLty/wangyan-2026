import { useState } from 'react';
import {
  App as AntdApp,
  Avatar,
  Button,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Tag,
  Typography,
} from 'antd';
import {
  cancelInvitation,
  inviteMember,
  removeMember,
  setMemberRole,
  type TeamInfo,
  type TeamMemberInfo,
} from '../../api/teams';

/**
 * 团队管理弹窗（论文 5.5.1 成员管理 / 5.5.2 邀请与审批）
 * 成员列表（owner 可调角色）+ 邮箱邀请 + 邀请记录（撤回）
 */
export default function TeamManageModal({
  team,
  members,
  invitationRecords,
  myUserId,
  onClose,
  onChanged,
}: {
  team: TeamInfo;
  members: TeamMemberInfo[];
  invitationRecords: { id: string; invitee_email: string; status: string }[];
  myUserId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { message } = AntdApp.useApp();
  const [inviteEmail, setInviteEmail] = useState('');

  const roleLabel = (role: string) =>
    role === 'owner' ? '创建者' : role === 'admin' ? '管理员' : '成员';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      await inviteMember(team.id, inviteEmail.trim());
      message.success('邀请已发出（7 天内有效）');
      setInviteEmail('');
      onChanged();
    } catch {
      message.error('邀请失败：可能已存在待处理邀请或对方已是成员');
    }
  };

  const handleRemove = async (targetUserId: string) => {
    const isSelf = targetUserId === myUserId;
    try {
      await removeMember(team.id, targetUserId);
      message.success(isSelf ? '已退出团队' : '已移除成员');
      if (isSelf) {
        onClose();
      } else {
        onChanged();
      }
    } catch {
      message.error('操作失败：权限不足或目标不可移除');
    }
  };

  return (
    <Modal
      open
      title={`团队「${team.name}」成员与邀请`}
      footer={null}
      onCancel={onClose}
      width={560}
      destroyOnClose
    >
      <Typography.Text strong>成员（{members.length}）</Typography.Text>
      <List
        size="small"
        dataSource={members}
        renderItem={(m) => {
          const actions = [];
          if (team.my_role === 'owner' && m.role !== 'owner') {
            actions.push(
              <Select
                key="role"
                size="small"
                value={m.role}
                style={{ width: 88 }}
                onChange={(role) => {
                  void setMemberRole(team.id, m.user_id, role).then(onChanged);
                }}
                options={[
                  { value: 'admin', label: '管理员' },
                  { value: 'member', label: '成员' },
                ]}
              />,
            );
          } else {
            actions.push(<Tag key="role-tag">{roleLabel(m.role)}</Tag>);
          }
          if (m.role !== 'owner') {
            actions.push(
              <Popconfirm
                key="remove"
                title={m.user_id === myUserId ? '退出团队？' : '移除该成员？'}
                okText="确定"
                cancelText="取消"
                onConfirm={() => void handleRemove(m.user_id)}
              >
                <Button danger size="small">
                  {m.user_id === myUserId ? '退出' : '移除'}
                </Button>
              </Popconfirm>,
            );
          }
          return (
            <List.Item actions={actions}>
              <List.Item.Meta
                avatar={
                  <Avatar style={{ backgroundColor: '#1677ff' }}>{m.username.charAt(0)}</Avatar>
                }
                title={m.username}
                description={m.email}
              />
            </List.Item>
          );
        }}
      />

      <Typography.Text strong>邀请成员</Typography.Text>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px' }}>
        <Input
          placeholder="对方注册邮箱"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          onPressEnter={() => void handleInvite()}
        />
        <Button type="primary" onClick={() => void handleInvite()}>
          发出邀请
        </Button>
      </div>

      {invitationRecords.length > 0 && (
        <>
          <Typography.Text strong>邀请记录</Typography.Text>
          <List
            size="small"
            dataSource={invitationRecords}
            renderItem={(r) => (
              <List.Item
                actions={
                  r.status === 'pending'
                    ? [
                        <Button
                          key="cancel"
                          size="small"
                          onClick={() => {
                            void cancelInvitation(team.id, r.id).then(onChanged);
                          }}
                        >
                          撤回
                        </Button>,
                      ]
                    : [
                        <Tag key="status">{roleLabel2(r.status)}</Tag>,
                      ]
                }
              >
                <span>{r.invitee_email}</span>
              </List.Item>
            )}
          />
        </>
      )}
    </Modal>
  );
}

function roleLabel2(status: string): string {
  return status === 'accepted'
    ? '已接受'
    : status === 'declined'
      ? '已拒绝'
      : status === 'expired'
        ? '已过期'
        : '已撤回';
}
