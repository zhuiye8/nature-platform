import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// CreatePoliceDto
// ---------------------------------------------------------------------------
export class CreatePoliceDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  projectRegisterId!: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  projectManagerId?: number;

  @IsString()
  @IsOptional()
  registerNo?: string;

  @IsString()
  @IsOptional()
  filingAgency?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  scanFileUrl?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

// ---------------------------------------------------------------------------
// UpdatePoliceDto
// ---------------------------------------------------------------------------
export class UpdatePoliceDto {
  @IsString()
  @IsOptional()
  registerNo?: string;

  @IsString()
  @IsOptional()
  filingAgency?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  projectManagerId?: number;

  @IsString()
  @IsOptional()
  scanFileUrl?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

// ---------------------------------------------------------------------------
// QueryPoliceDto
// ---------------------------------------------------------------------------
export class QueryPoliceDto {
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

  @IsString()
  @IsOptional()
  status?: string;
}
