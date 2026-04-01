import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// CreateCustomerDto
// ---------------------------------------------------------------------------
export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  addressDetail?: string;

  @IsString()
  @IsOptional()
  uscc?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  mobilePhone?: string;

  @IsBoolean()
  @IsOptional()
  isGovernment?: boolean;

  @IsString()
  @IsOptional()
  remark?: string;
}

// ---------------------------------------------------------------------------
// UpdateCustomerDto — all fields optional
// ---------------------------------------------------------------------------
export class UpdateCustomerDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  addressDetail?: string;

  @IsString()
  @IsOptional()
  uscc?: string;

  @IsString()
  @IsOptional()
  contactName?: string;

  @IsString()
  @IsOptional()
  mobilePhone?: string;

  @IsBoolean()
  @IsOptional()
  isGovernment?: boolean;

  @IsString()
  @IsOptional()
  remark?: string;
}

// ---------------------------------------------------------------------------
// QueryCustomerDto — pagination + keyword search
// ---------------------------------------------------------------------------
export class QueryCustomerDto {
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
}
