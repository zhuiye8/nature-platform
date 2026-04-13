import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PoliceService } from './police.service';
import { QueryPoliceDto } from './dto/police.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { Response } from 'express';

@Controller('police')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PoliceController {
  constructor(private readonly policeService: PoliceService) {}

  @Get('page')
  @RequirePermission('police:list')
  async findPage(
    @Query() query: QueryPoliceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.policeService.findPage(query, user.id);
  }

  @Get(':id/export')
  @RequirePermission('police:list')
  async exportExcel(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { buffer, fileName } = await this.policeService.exportExcel(id);
    const encodedName = encodeURIComponent(fileName);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });
    res.send(buffer);
  }

  @Get(':id')
  @RequirePermission('police:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.policeService.findById(id);
  }
}
