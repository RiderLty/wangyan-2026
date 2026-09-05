import { Layout, Typography, Steps } from 'antd';

const { Header, Content, Footer } = Layout;
const { Title, Paragraph } = Typography;

/** 脚手架验证页：确认前后端联调链路后，按论文模块逐步替换（5.2~5.8） */
export default function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
          在线Markdown笔记编辑与管理平台
        </Typography.Title>
      </Header>
      <Content style={{ padding: '24px 48px' }}>
        <Title level={3}>脚手架搭建成功 🎉</Title>
        <Paragraph type="secondary">
          React 18 + TypeScript + Ant Design 前端已就绪，API 通过 Vite 代理至 NestJS
          后端（/api），WebSocket 代理至 /ws。
        </Paragraph>
        <Steps
          direction="vertical"
          size="small"
          current={1}
          items={[
            { title: '脚手架搭建', description: 'monorepo + Docker 编排' },
            { title: '用户认证模块（5.2）', description: '注册 / 登录 / JWT' },
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
