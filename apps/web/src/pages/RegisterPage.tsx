import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/** 注册页（论文 5.2.1 / 5.2.4 界面展示），注册成功后自动登录 */
export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: {
    email: string;
    username: string;
    password: string;
    confirm: string;
  }) => {
    setSubmitting(true);
    try {
      await register(values.email, values.username, values.password);
      messageApi.success('注册成功，已自动登录');
      navigate('/');
    } catch (e) {
      messageApi.error(extractErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
      }}
    >
      {contextHolder}
      <Card style={{ width: 400, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>
          注册 · 云笔记
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="you@example.com" size="large" />
          </Form.Item>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, max: 50, message: '用户名 3-50 个字符' },
              {
                pattern: /^[\w一-龥-]+$/,
                message: '仅支持字母、数字、下划线、中文和连字符',
              },
            ]}
          >
            <Input placeholder="展示名称" size="large" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            extra="至少 8 位，须同时包含字母和数字"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, max: 32, message: '密码 8-32 位' },
              { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: '必须同时包含字母和数字' },
            ]}
          >
            <Input.Password placeholder="密码" size="large" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('password') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入密码" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
              注册
            </Button>
          </Form.Item>
          <Typography.Paragraph style={{ textAlign: 'center', margin: 0 }}>
            已有账号？<Link to="/login">直接登录</Link>
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
}
