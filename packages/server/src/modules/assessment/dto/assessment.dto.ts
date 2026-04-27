import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// SubmitAssessmentDto — submit my assessment part
// ---------------------------------------------------------------------------
export class SubmitAssessmentDto {
  @Type(() => Number)
  @IsInt()
  projectRegisterId!: number;

  @IsString()
  @IsOptional()
  assessmentDetail?: string;

  @IsString()
  @IsOptional()
  assessmentRemark?: string;
}

// ---------------------------------------------------------------------------
// QueryAssessmentDto — list my assessments
// ---------------------------------------------------------------------------
export class QueryAssessmentDto {
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
  keyword?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  contractYear?: number;

  @IsString()
  @IsOptional()
  assessmentStatus?: string;
}
