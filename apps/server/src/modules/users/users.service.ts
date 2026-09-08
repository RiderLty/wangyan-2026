import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/** 用户服务（论文 4.2.2 用户认证模块设计中的用户数据访问层） */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** 按 email 查找（含密码哈希，仅供登录校验） */
  findByEmailWithHash(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email })
      .getOne();
  }

  findOne(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  existsByEmail(email: string): Promise<boolean> {
    return this.users.exists({ where: { email } });
  }

  existsByUsername(username: string): Promise<boolean> {
    return this.users.exists({ where: { username } });
  }

  create(data: { email: string; username: string; password_hash: string }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }

  async findSafeById(id: string): Promise<User> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }
}
