/**
 * 前后端共享类型定义（packages/shared）
 * 对应论文 5.1.2 项目目录结构
 */

/** 统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** 用户角色（论文 3.2 系统用户角色） */
export enum UserRole {
  /** 个人用户 / 团队成员 */
  MEMBER = 'member',
  /** 团队管理员 */
  ADMIN = 'admin',
}

/** 团队成员角色（论文 4.5.3 团队级权限控制） */
export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}
