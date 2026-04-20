import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;

  @IsString()
  @IsOptional()
  captchaId?: string;

  @IsString()
  @IsOptional()
  captchaAnswer?: string;
}
