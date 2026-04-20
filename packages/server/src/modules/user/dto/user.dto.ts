import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  MinLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/, {
    message: '用户名只能包含字母、数字和下划线，长度3-32位',
  })
  username!: string;

  @IsString()
  @MinLength(8, { message: '密码长度不能少于8位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '密码必须同时包含英文字母和数字',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  deptId?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  deptId?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class QueryUserDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @IsString()
  @IsOptional()
  keyword?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;
}

export class AssignRolesDto {
  @IsArray()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: '密码长度不能少于8位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: '密码必须同时包含英文字母和数字',
  })
  newPassword!: string;
}
