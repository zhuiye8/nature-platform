import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ContractService } from './contract.service';
import {
  CreateContractDto,
  UpdateContractDto,
  QueryContractDto,
  UpdateFinancialDto,
  ArchiveContractDto,
} from './dto/contract.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('contract')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ContractController {
  constructor(private readonly contractService: ContractService) {}

  @Get('payer-options')
  @RequirePermission('contract:list')
  async getPayerOptions(@Query('keyword') keyword?: string) {
    return this.contractService.getPayerOptions(keyword);
  }

  @Get('page')
  @RequirePermission('contract:list')
  async findPage(
    @Query() query: QueryContractDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.findPage(query, user.id);
  }

  @Get(':id')
  @RequirePermission('contract:list')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.findById(id, user.id);
  }

  @Post()
  @RequirePermission('contract:create')
  async create(
    @Body() dto: CreateContractDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('contract:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('contract:delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    await this.contractService.remove(id, user.id);
    return { success: true };
  }

  @Post(':id/submit')
  @RequirePermission('contract:create')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.submit(id, user.id);
  }

  @Patch(':id/financial')
  @RequirePermission('contract:update_financial')
  async updateFinancial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFinancialDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.updateFinancial(id, dto, user.id);
  }

  @Post(':id/archive')
  @RequirePermission('contract:archive')
  async archive(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ArchiveContractDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.contractService.archive(id, dto, user.id);
  }
}
