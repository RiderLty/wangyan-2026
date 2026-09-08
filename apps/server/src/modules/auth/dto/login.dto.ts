import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** 登录参数（论文 5.2.2 登录与 JWT Token 生成） */
export class LoginDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  @MaxLength(32)
  password: string;
}
