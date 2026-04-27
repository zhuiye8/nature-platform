import { IsString, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentRecordDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  // 回款日期：必须 ≤ today，service 层校验
  @IsDateString()
  paidAt!: string;

  @IsString()
  @IsOptional()
  payer?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}
