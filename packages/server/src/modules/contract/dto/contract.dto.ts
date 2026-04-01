import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// CreateSystemItemDto
// ---------------------------------------------------------------------------
export class CreateSystemItemDto {
  @IsString()
  @IsNotEmpty()
  systemName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  systemLevel!: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

// ---------------------------------------------------------------------------
// CreateContractDto
// ---------------------------------------------------------------------------
export class CreateContractDto {
  @Type(() => Number)
  @IsNumber()
  customerId!: number;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  payerType?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  payerId?: number;

  @IsString()
  @IsOptional()
  paymentCompany?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  paymentAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  partnerId?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  salesPersonId?: number;

  @IsString()
  @IsOptional()
  performanceCity?: string;

  @IsString()
  @IsOptional()
  dealStatus?: string;

  @IsString()
  @IsOptional()
  contractType?: string;

  @IsArray()
  @Type(() => Number)
  serviceYears!: number[];

  @IsString()
  @IsOptional()
  serviceYearDetail?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSystemItemDto)
  systemItems!: CreateSystemItemDto[];
}

// ---------------------------------------------------------------------------
// UpdateContractDto — all fields optional
// ---------------------------------------------------------------------------
export class UpdateContractDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  customerId?: number;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  payerType?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  payerId?: number;

  @IsString()
  @IsOptional()
  paymentCompany?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  paymentAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  partnerId?: number;

  @IsNumber()
  @IsOptional()
  salesPersonId?: number;

  @IsString()
  @IsOptional()
  performanceCity?: string;

  @IsString()
  @IsOptional()
  dealStatus?: string;

  @IsString()
  @IsOptional()
  contractType?: string;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  serviceYears?: number[];

  @IsString()
  @IsOptional()
  serviceYearDetail?: string;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSystemItemDto)
  @IsOptional()
  systemItems?: CreateSystemItemDto[];
}

// ---------------------------------------------------------------------------
// QueryContractDto — pagination + keyword + filter
// ---------------------------------------------------------------------------
export class QueryContractDto {
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
  reviewStatus?: string;

  @IsString()
  @IsOptional()
  archiveStatus?: string;

  @IsString()
  @IsOptional()
  onlyMine?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  createdByUserId?: number;
}

// ---------------------------------------------------------------------------
// UpdateFinancialDto — for commercial to update financial fields
// ---------------------------------------------------------------------------
export class UpdateFinancialDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  paymentAmount?: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  paymentCompany?: string;

  @IsString()
  @IsOptional()
  payerType?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  payerId?: number;

  @IsString()
  @IsOptional()
  performanceCity?: string;

  @IsString()
  @IsOptional()
  paymentStatus?: string;

  @IsString()
  @IsOptional()
  paymentRemark?: string;
}

// ---------------------------------------------------------------------------
// ArchiveContractDto — for contract archive operation
// ---------------------------------------------------------------------------
export class ArchiveContractDto {
  @IsString()
  @IsOptional()
  signedAt?: string;

  @IsString()
  @IsOptional()
  storageLocation?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  fileCount?: number;

  @IsString()
  @IsOptional()
  archiveRemark?: string;

  @IsOptional()
  isComplete?: boolean; // true=已完成归档(ARCHIVED), false=未完成归档(PARTIAL_ARCHIVE)
}
