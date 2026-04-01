import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryRecycleDto {
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
  bizType?: string; // CONTRACT | PROJECT_REGISTER
}
