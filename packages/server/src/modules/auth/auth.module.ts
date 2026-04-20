import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { CaptchaService } from './captcha.service';
import { LoginThrottleService } from './login-throttle.service';
import { DingtalkModule } from '../dingtalk/dingtalk.module';

@Module({
  imports: [
    PassportModule,
    DingtalkModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '2h') as any,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CaptchaService, LoginThrottleService],
  exports: [AuthService],
})
export class AuthModule {}
