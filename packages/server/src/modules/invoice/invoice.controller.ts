import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InvoiceService } from './invoice.service';
import {
  CreateInvoiceDto,
  QueryInvoiceDto,
  ReviewInvoiceDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

@Controller('invoice')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InvoiceController {
  constructor(private readonly service: InvoiceService) {}

  @Get('page')
  @RequirePermission('invoice:apply')
  async findPage(
    @Query() query: QueryInvoiceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.findPage(query, user.id);
  }

  @Get(':id')
  @RequirePermission('invoice:apply')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.findById(id, user.id);
  }

  @Post()
  @RequirePermission('invoice:apply')
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('invoice:apply')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/submit')
  @RequirePermission('invoice:apply')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.submit(id, user.id);
  }

  @Post(':id/review')
  @RequirePermission('invoice:review')
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewInvoiceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.review(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('invoice:apply')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.remove(id, user.id);
  }
}
