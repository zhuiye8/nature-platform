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
import { ProjectService } from './project.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectDto,
  AssignMembersDto,
  CreateProjectSystemItemDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('project')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get('page')
  @RequirePermission('project:list')
  async findPage(
    @Query() query: QueryProjectDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.projectService.findPage(query, user.id);
  }

  @Get('available-years/:contractId')
  @RequirePermission('project:create')
  async getAvailableYears(
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.projectService.getAvailableYears(contractId);
  }

  // 开票申请 / 费用请款 选系统时使用：返回该合同下所有项目登记已通过(system_no IS NOT NULL)的系统
  // 鉴权用 invoice:apply（所有人都有此权限）
  @Get('system-options/:contractId')
  @RequirePermission('invoice:apply')
  async getSystemOptions(
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.projectService.findSystemOptionsForContract(contractId);
  }

  @Get('contract-system-quota/:contractId')
  @RequirePermission('project:create')
  async getContractSystemQuota(
    @Param('contractId', ParseIntPipe) contractId: number,
    @Query('excludeProjectId') excludeProjectId?: string,
  ) {
    const excl = excludeProjectId ? parseInt(excludeProjectId, 10) : undefined;
    return this.projectService.getContractSystemQuota(contractId, excl);
  }

  @Get(':id')
  @RequirePermission('project:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findById(id);
  }

  @Post()
  @RequirePermission('project:create')
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.projectService.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('project:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.projectService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('project:delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    await this.projectService.remove(id, user.id);
    return { success: true };
  }

  @Post(':id/submit')
  @RequirePermission('project:create')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.projectService.submit(id, user.id);
  }

  @Put(':id/members')
  @RequirePermission('project:assign_team')
  async assignMembers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignMembersDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.projectService.assignMembers(id, dto, user.id);
  }

  // ── System Item CRUD ──

  @Get(':id/system-items')
  @RequirePermission('project:list')
  async getSystemItems(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.getSystemItems(id);
  }

  @Post(':id/system-items')
  @RequirePermission('project:update')
  async createSystemItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProjectSystemItemDto,
  ) {
    return this.projectService.createSystemItem(id, dto);
  }

  @Put(':id/system-items/:itemId')
  @RequirePermission('project:update')
  async updateSystemItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CreateProjectSystemItemDto,
  ) {
    return this.projectService.updateSystemItem(id, itemId, dto);
  }

  @Delete(':id/system-items/:itemId')
  @RequirePermission('project:update')
  async deleteSystemItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    await this.projectService.deleteSystemItem(id, itemId);
    return { success: true };
  }
}
