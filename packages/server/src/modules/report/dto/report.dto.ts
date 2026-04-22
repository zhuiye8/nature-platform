import { IsString, IsOptional, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitReportDto {
  @Type(() => Number)
  @IsInt()
  projectRegisterId!: number;

  @IsString()
  @IsOptional()
  remark?: string;
}

/** 报告管理列表的业务状态筛选值（前后端共用字典）。 */
export const REPORT_STATUS_VALUES = [
  'PENDING',      // 待编制
  'REVIEWING',    // 审核中（FINAL_REVIEW）
  'REVISION',     // 待修改（复核退回）
  'APPROVED',     // 已通过（最终审核通过，后续节点或已完成都算）
] as const;
export type ReportStatus = (typeof REPORT_STATUS_VALUES)[number];

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

  /** 按项目名称模糊搜索 */
  @IsString()
  @IsOptional()
  keyword?: string;

  /** 按业务状态筛选 */
  @IsIn([...REPORT_STATUS_VALUES])
  @IsOptional()
  status?: ReportStatus;

  /** 按编制人 userId 筛选（用于主管/管理员视角） */
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  compilerId?: number;
}
