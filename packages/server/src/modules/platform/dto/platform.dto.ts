import { IsString, IsOptional, IsNotEmpty, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlatformDto {
  @IsString() @IsOptional() platformName?: string;
  @IsString() @IsOptional() websiteUrl?: string;
  @IsString() @IsOptional() account?: string;
  @IsString() @IsOptional() password?: string;
  @IsBoolean() @IsOptional() hasCa?: boolean;
  @IsString() @IsOptional() caExpireDate?: string;
  @IsString() @IsOptional() caPassword?: string;
  @IsString() @IsOptional() contactName?: string;
  @IsString() @IsOptional() contactPhone?: string;
  @IsString() @IsOptional() remark?: string;
}

export class UpdatePlatformDto extends CreatePlatformDto {}

export class QueryPlatformDto {
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page?: number = 1;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() pageSize?: number = 10;
  @IsString() @IsOptional() platformName?: string;
  @IsString() @IsOptional() websiteUrl?: string;
  @IsString() @IsOptional() hasCa?: string;
  @IsString() @IsOptional() caExpireDateFrom?: string;
  @IsString() @IsOptional() caExpireDateTo?: string;
  @Type(() => Number) @IsInt() @IsOptional() createdByUserId?: number;
}
