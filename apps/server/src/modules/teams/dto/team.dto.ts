import { IsIn, IsOptional, IsString, IsEmail, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/** POST /teams/:id/invitations —— 按邮箱邀请（论文 5.5.2） */
export class InviteMemberDto {
  @IsEmail()
  email: string;
}

/** PATCH /teams/:id/members/:userId —— 调整成员角色（仅 owner） */
export class SetMemberRoleDto {
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member';
}
