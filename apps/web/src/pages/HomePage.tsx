import { Avatar, Button, Layout, Steps, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const { Header, Content, Footer } = Layout;

/** 首页占位（论文 5.2.4 登录后界面；5.3 起逐步替换为笔记管理界面） */
export default function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 24,
        }}
      >
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          在线Markdown笔记编辑与管理平台
        </Typography.Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar style={{ backgroundColor: '#1677ff' }}>
            {user?.username?.charAt(0)?.toUpperCase()}
          </Avatar>
          <span style={{ color: '#fff' }}>{user?.username}</span>
          <Button ghost size="small" onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </Header>
      <Content style={{ padding: '24px 48px' }}>
        <Typography.Title level={3}>
          欢迎回来，{user?.username} 👋
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          已通过 JWT 身份校验（Bearer Token）。笔记管理界面将在 5.3 模块实现，当前为脚手架占位页。
        </Typography.Paragraph>
        <Steps
          direction="vertical"
          size="small"
          current={2}
          items={[
            { title: '脚手架搭建', description: 'monorepo + Docker 编排' },
            { title: '用户认证模块（5.2）', description: '注册 / 登录 / JWT ✅' },
            { title: '个人笔记管理（5.3）', description: 'Tiptap 编辑器 + 文件夹 + 搜索' },
            { title: '实时协作编辑（5.4）', description: 'Yjs + WebSocket + 多光标' },
            { title: '团队协作（5.5）', description: '团队 / 邀请 / 权限' },
            { title: '分享 / 版本 / 回收站 / 导出（5.6~5.8）' },
            { title: '部署与测试（5.9 / 第6章）' },
          ]}
        />
      </Content>
      <Footer style={{ textAlign: 'center' }}>毕业论文配套系统 · 2026</Footer>
    </Layout>
  );
}
