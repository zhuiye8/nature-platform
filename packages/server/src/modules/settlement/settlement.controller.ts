import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SettlementService } from './settlement.service';
import { QuerySettlementDto } from './dto/settlement.dto';

@Controller('settlement')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettlementController {
  constructor(private readonly service: SettlementService) {}

  @Get('group/page')
  @RequirePermission('settlement:view')
  async findGroupPage(@Query() query: QuerySettlementDto) {
    return this.service.findGroupPage(query);
  }

  @Get('contract/:id')
  @RequirePermission('settlement:view')
  async findContractDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.findContractDetail(id);
  }
}
