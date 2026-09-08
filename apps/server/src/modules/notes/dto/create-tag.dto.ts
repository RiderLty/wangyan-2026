import { IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name: string;

  /** 展示色，#RRGGBB */
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
