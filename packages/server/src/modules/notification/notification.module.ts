import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationListener } from './notification.listener';
import { ReminderScheduler } from './reminder.scheduler';
import { DingtalkModule } from '../dingtalk/dingtalk.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
    DingtalkModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationListener, ReminderScheduler],
  exports: [NotificationService],
})
export class NotificationModule {}
