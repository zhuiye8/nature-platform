import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PartnerService } from './partner.service';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/partner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('partner')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get('list')
  @RequirePermission('partner:list')
  async findAll() {
    return this.partnerService.findAll();
  }

  @Get(':id')
  @RequirePermission('partner:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.partnerService.findById(id);
  }

  @Post()
  @RequirePermission('partner:create')
  async create(@Body() dto: CreatePartnerDto, @CurrentUser() user: { id: number }) {
    return this.partnerService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('partner:update')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePartnerDto) {
    return this.partnerService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('partner:delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.partnerService.remove(id);
  }
}
