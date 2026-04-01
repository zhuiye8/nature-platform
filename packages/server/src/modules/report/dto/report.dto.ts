import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReportDto {
  @Type(() => Number)
  @IsInt()
  projectRegisterId!: number;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class QueryReportDto {
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
}
