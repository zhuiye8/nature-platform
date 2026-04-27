import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentRecordService } from './payment-record.service';
import { CreatePaymentRecordDto } from './dto/payment-record.dto';

/**
 * 回款明细 API
 *
 * 路由前缀挂在合同下: /api/contract/:id/payment-record
 *   - POST   /:id/payment-record         录入回款 (finance / super_admin)
 *   - GET    /:id/payment-record         查看明细 (列表权限由 contract:list + 可见性控制)
 *   - DELETE /:id/payment-record/:pid    删除 (仅 super_admin，service 内二次校验)
 */
@Controller('contract/:id/payment-record')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PaymentRecordController {
  constructor(private readonly service: PaymentRecordService) {}

  @Post()
  @RequirePermission('payment:record')
  async create(
    @Param('id', ParseIntPipe) contractId: number,
    @Body() dto: CreatePaymentRecordDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.create(contractId, dto, user.id);
  }

  @Get()
  @RequirePermission('contract:list')
  async list(
    @Param('id', ParseIntPipe) contractId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.findByContract(contractId, user.id);
  }

  @Delete(':pid')
  @RequirePermission('payment:record')
  async remove(
    @Param('id', ParseIntPipe) contractId: number,
    @Param('pid', ParseIntPipe) recordId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.remove(contractId, recordId, user.id);
  }
}
