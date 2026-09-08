import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 用户表实体（论文 4.3.2 用户表 users）
 * 结构与 docs/diagrams/database-design.md §3.1 一一对应
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  /** bcrypt 哈希，永不出库（论文 3.4.2 安全性需求） */
  @Column({ type: 'varchar', length: 100, select: false })
  password_hash: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar_url: string | null;

  @CreateDateColumn()
  @Index()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /** 脱敏视图：返回给前端/JWT payload 的安全子集 */
  toSafe() {
    return { id: this.id, email: this.email, username: this.username, avatar_url: this.avatar_url };
  }
}
