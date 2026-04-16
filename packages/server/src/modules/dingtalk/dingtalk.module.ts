import { Module } from '@nestjs/common';
import { DingtalkNotifyService } from './dingtalk-notify.service';

@Module({
  providers: [DingtalkNotifyService],
  exports: [DingtalkNotifyService],
})
export class DingtalkModule {}
