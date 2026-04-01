import {
  Controller,
  Get,
  Put,
  Delete,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('notification')
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findByUser(
    @CurrentUser() user: { id: number },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.notificationService.findByUser(
      user.id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@CurrentUser() user: { id: number }) {
    return this.notificationService.getUnreadCount(user.id);
  }

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    await this.notificationService.markRead(id, user.id);
    return { success: true };
  }

  @Put('read-all')
  @UseGuards(JwtAuthGuard)
  async markAllRead(@CurrentUser() user: { id: number }) {
    await this.notificationService.markAllRead(user.id);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    await this.notificationService.remove(id, user.id);
    return { success: true };
  }

  @Sse('stream')
  async stream(
    @Query('token') token: string,
  ): Promise<Observable<MessageEvent>> {
    // Manually verify JWT token (SSE doesn't support Authorization header)
    try {
      const payload = this.jwtService.verify(token);
      return this.notificationService.createStream(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
