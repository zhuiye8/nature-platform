import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PoliceService } from './police.service';
import { CreatePoliceDto, UpdatePoliceDto, QueryPoliceDto } from './dto/police.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

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

  @Get('project-managers')
  @RequirePermission('police:list')
  async getProjectManagers() {
    return this.policeService.getProjectManagers();
  }

  @Get('available-projects')
  @RequirePermission('police:list')
  async getAvailableProjects() {
    return this.policeService.getAvailableProjects();
  }

  @Get(':id')
  @RequirePermission('police:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.policeService.findById(id);
  }

  @Post()
  @RequirePermission('police:create')
  async create(@Body() dto: CreatePoliceDto, @CurrentUser() user: { id: number }) {
    return this.policeService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('police:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePoliceDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.policeService.update(id, dto, user.id);
  }

  @Post(':id/complete')
  @RequirePermission('police:complete')
  async complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.policeService.complete(id, user.id);
  }
}
