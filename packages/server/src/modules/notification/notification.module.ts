import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationListener } from './notification.listener';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationListener],
  exports: [NotificationService],
})
export class NotificationModule {}
