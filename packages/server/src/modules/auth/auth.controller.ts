import { Controller, Post, Get, Body, UseGuards, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Get('captcha')
  async getCaptcha() {
    if (!this.captchaService.isEnabled()) {
      return { enabled: false };
    }
    const { captchaId, svg } = await this.captchaService.generate();
    return { enabled: true, captchaId, svg };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { id: number; username: string }) {
    return this.authService.validateUser(user.id);
  }

  // ── DingTalk OAuth ──

  @Get('dingtalk/auth-url')
  async getDingtalkAuthUrl() {
    return this.authService.getDingtalkAuthUrl();
  }

  @Post('dingtalk/login')
  async dingtalkLogin(@Body() body: { authCode: string }) {
    return this.authService.dingtalkLogin(body.authCode);
  }

  @Post('dingtalk/bind')
  async dingtalkBind(@Body() body: { userId: number; password: string; dingtalkInfo: any }) {
    return this.authService.dingtalkBindWithPassword(body.userId, body.password, body.dingtalkInfo);
  }

  @Post('dingtalk/create')
  async dingtalkCreate(@Body() body: { dingtalkInfo: any }) {
    return this.authService.dingtalkCreateUser(body.dingtalkInfo);
  }

  @UseGuards(JwtAuthGuard)
  @Post('request-role')
  async requestRole(@CurrentUser() user: { id: number }) {
    return this.authService.requestRole(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('dingtalk/unbind')
  async dingtalkUnbind(@CurrentUser() user: { id: number }) {
    await this.authService.unbindDingtalk(user.id);
    return { success: true };
  }
}
