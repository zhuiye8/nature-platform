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
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('role')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('list')
  @RequirePermission('role:list')
  async findAll() {
    return this.roleService.findAll();
  }

  @Get('all-permissions')
  @RequirePermission('role:list')
  async getAllPermissions() {
    return this.roleService.getAllPermissions();
  }

  @Get(':roleCode/users')
  @RequirePermission('role:manage')
  async getUsersByRole(@Param('roleCode') roleCode: string) {
    return this.roleService.getUsersByRole(roleCode);
  }

  @Put(':roleCode/users')
  @RequirePermission('role:manage')
  async updateRoleUsers(
    @Param('roleCode') roleCode: string,
    @Body() body: { users: { userId: number; sortOrder: number }[] },
  ) {
    return this.roleService.updateRoleUsers(roleCode, body.users);
  }

  @Get(':id')
  @RequirePermission('role:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findById(id);
  }

  @Post()
  @RequirePermission('role:create')
  async create(@Body() dto: CreateRoleDto) {
    return this.roleService.create(dto);
  }

  @Put(':id')
  @RequirePermission('role:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('role:delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.remove(id);
  }

  @Put('assign-permissions/:roleCode')
  @RequirePermission('role:update')
  async assignPermissions(
    @Param('roleCode') roleCode: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    return this.roleService.assignPermissions(roleCode, dto);
  }
}
