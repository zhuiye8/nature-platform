import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 结算管理列表筛选 DTO
 *
 * 时间范围按 contract.signed_at 过滤（合同签订日期）
 * 默认全部（不传 startDate/endDate）
 */
export class QuerySettlementDto {
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
  keyword?: string;       // 搜合同组名 / 合同名 / 合同编号

  @IsString()
  @IsOptional()
  serviceContent?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  customerId?: number;

  // 时间范围 (按 contract.signed_at)
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
