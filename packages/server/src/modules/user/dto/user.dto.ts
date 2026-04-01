import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsInt,
  IsArray,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @MinLength(6)
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
  @MinLength(6)
  newPassword!: string;
}
