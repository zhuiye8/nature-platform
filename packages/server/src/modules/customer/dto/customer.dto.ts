import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// ContactDto — single contact entry
// ---------------------------------------------------------------------------
export class ContactDto {
  @IsString()
  @IsNotEmpty()
  contactName!: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

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

  @IsBoolean()
  @IsOptional()
  isGovernment?: boolean;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  @IsOptional()
  contacts?: ContactDto[];
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

  @IsBoolean()
  @IsOptional()
  isGovernment?: boolean;

  @IsString()
  @IsOptional()
  remark?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  @IsOptional()
  contacts?: ContactDto[];
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
