import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const EXPENSE_TYPES = [
  '报名费',
  '代理费',
  '专家费',
  '合作费',
  '项目提成',
  '差旅费',
  '其它',
] as const;

export class ExpenseSystemEntryDto {
  @Type(() => Number)
  @IsInt()
  systemId!: number; // project_system_item.id
}

export class CreateExpenseDto {
  @Type(() => Number)
  @IsInt()
  contractId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseSystemEntryDto)
  systems!: ExpenseSystemEntryDto[];

  // 费用类型 (枚举)
  @IsString()
  @IsIn(EXPENSE_TYPES as unknown as string[])
  expenseType!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  requestAmount!: number;

  // 差旅费时这 3 个可选；其它情况由 service 层校验是否必填
  @IsString()
  @IsOptional()
  invoiceType?: string;

  @IsString()
  @IsOptional()
  taxRate?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  invoiceAmount?: number;

  // 收款人信息
  @IsString()
  @IsNotEmpty()
  payeeName!: string;

  @IsString()
  @IsNotEmpty()
  payeeBank!: string;

  // 银行账号: 10-30 位纯数字 (兼容个人卡 + 对公账户)
  @IsString()
  @Matches(/^\d{10,30}$/, { message: '收款人银行账号格式不正确（应为 10-30 位数字）' })
  payeeAccount!: string;

  // 合作方信息 (合作费时必填，service 层校验)
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  partnerId?: number;

  @IsString()
  @IsOptional()
  partnerName?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  partnerAmount?: number;

  @IsString()
  @IsOptional()
  partnerInvoiceType?: string;

  @IsString()
  @IsOptional()
  partnerTaxRate?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateExpenseDto extends CreateExpenseDto {}

export class QueryExpenseDto {
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

  @IsString()
  @IsOptional()
  expenseType?: string;
}

export class ReviewExpenseDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT'])
  action!: 'APPROVE' | 'REJECT';

  @IsString()
  @IsOptional()
  remark?: string;
}
