import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** 注册参数（论文 5.2.1 注册功能实现） */
export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  email: string;

  @IsString()
  @MinLength(3, { message: '用户名至少 3 个字符' })
  @MaxLength(50)
  @Matches(/^[\w一-龥-]+$/, { message: '用户名只能包含字母、数字、下划线、中文和连字符' })
  username: string;

  @IsString()
  @MinLength(8, { message: '密码至少 8 位' })
  @MaxLength(32)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: '密码必须同时包含字母和数字' })
  password: string;
}
