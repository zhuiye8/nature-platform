import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceSystemEntryDto {
  @Type(() => Number)
  @IsInt()
  systemId!: number;        // project_system_item.id

  // 系统金额：必填
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class CreateInvoiceDto {
  @Type(() => Number)
  @IsInt()
  contractId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceSystemEntryDto)
  systems!: InvoiceSystemEntryDto[];

  @IsString()
  @IsNotEmpty()
  invoiceContent!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  applyAmount!: number;

  @IsString()
  @IsNotEmpty()
  invoiceType!: string;

  @IsString()
  @IsNotEmpty()
  taxRate!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateInvoiceDto extends CreateInvoiceDto {}

export class QueryInvoiceDto {
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

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  serviceContent?: string;
}

export class ReviewInvoiceDto {
  @IsString()
  @IsNotEmpty()
  action!: 'APPROVE' | 'REJECT';

  @IsString()
  @IsOptional()
  remark?: string;
}
