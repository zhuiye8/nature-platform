import { IsString, IsOptional, IsInt, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitArchiveDto {
  @Type(() => Number)
  @IsInt()
  projectRegisterId!: number;

  @IsArray()
  @IsOptional()
  materialStatusCodes?: string[];

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  fileCount?: number;

  @IsString()
  @IsOptional()
  storageLocation?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class QueryArchiveDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 10;

  @IsString()
  @IsOptional()
  archiveStatus?: string;
}
