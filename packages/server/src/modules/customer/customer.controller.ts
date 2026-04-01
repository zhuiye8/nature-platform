import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  QueryCustomerDto,
} from './dto/customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('customer')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('page')
  @RequirePermission('customer:list')
  async findPage(
    @Query() query: QueryCustomerDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.customerService.findPage(query, user.id);
  }

  @Get(':id')
  @RequirePermission('customer:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.customerService.findById(id);
  }

  @Post()
  @RequirePermission('customer:create')
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.customerService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('customer:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.customerService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('customer:delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    await this.customerService.remove(id, user.id);
    return { success: true };
  }
}
