import { Module } from '@nestjs/common';
import { PaymentRecordController } from './payment-record.controller';
import { PaymentRecordService } from './payment-record.service';

@Module({
  controllers: [PaymentRecordController],
  providers: [PaymentRecordService],
  exports: [PaymentRecordService],
})
export class PaymentRecordModule {}
