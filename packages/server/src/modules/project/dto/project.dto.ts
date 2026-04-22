import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// CreateProjectSystemItemDto
// ---------------------------------------------------------------------------
export class CreateProjectSystemItemDto {
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsOptional()
  clientKey?: string;

  @IsString()
  @IsNotEmpty()
  systemName!: string;

  @IsString()
  @IsOptional()
  filingAgency?: string;

  /** 备案地区完整级联路径 "省/市/区"，用于前端 cascader 完整回显 */
  @IsString()
  @IsOptional()
  filingRegion?: string;

  @IsString()
  @IsOptional()
  securityLevel?: string;

  @IsBoolean()
  @IsOptional()
  isReassessment?: boolean;

  @IsString()
  @IsOptional()
  requiredEntryDate?: string;

  @IsString()
  @IsOptional()
  requiredReportDeliveryDate?: string;

  @IsString()
  @IsNotEmpty()
  assessedUnitName!: string;

  @IsString()
  @IsOptional()
  assessedUnitIndustry?: string;

  @IsString()
  @IsNotEmpty()
  assessedUnitContact!: string;

  @IsString()
  @IsNotEmpty()
  assessedUnitMobile!: string;

  @IsString()
  @IsOptional()
  assessedUnitAddress?: string;

  @IsBoolean()
  @IsOptional()
  hasFilingCertificate?: boolean;

  @IsString()
  @IsOptional()
  filingCertificateNo?: string;

  @IsString()
  @IsOptional()
  filingCertificateIssuedAt?: string;

  @IsBoolean()
  @IsOptional()
  hasFilingForm?: boolean;

  @IsBoolean()
  @IsOptional()
  hasClassificationReport?: boolean;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// CreateProjectDto
// ---------------------------------------------------------------------------
export class CreateProjectDto {
  @IsNumber()
  contractId!: number;

  @IsInt()
  contractYear!: number;

  @IsString()
  @IsOptional()
  applicationName?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectSystemItemDto)
  @IsOptional()
  systemItems?: CreateProjectSystemItemDto[];
}

// ---------------------------------------------------------------------------
// UpdateProjectDto — all fields optional
// ---------------------------------------------------------------------------
export class UpdateProjectDto {
  @IsNumber()
  @IsOptional()
  contractId?: number;

  @IsInt()
  @IsOptional()
  contractYear?: number;

  @IsString()
  @IsOptional()
  applicationName?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectSystemItemDto)
  @IsOptional()
  systemItems?: CreateProjectSystemItemDto[];
}

// ---------------------------------------------------------------------------
// QueryProjectDto — pagination + keyword + filter
// ---------------------------------------------------------------------------
export class QueryProjectDto {
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

// ---------------------------------------------------------------------------
// AssignMembersDto
// ---------------------------------------------------------------------------
export class AssignMemberItemDto {
  @IsNumber()
  userId!: number;

  @IsString()
  @IsNotEmpty()
  roleType!: string;
}

export class AssignMembersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignMemberItemDto)
  members!: AssignMemberItemDto[];
}
