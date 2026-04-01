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
import { UserService } from './user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  AssignRolesDto,
  ResetPasswordDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('user')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('page')
  @RequirePermission('user:list')
  async findPage(@Query() query: QueryUserDto) {
    return this.userService.findPage(query);
  }

  @Get('simple-list')
  @RequirePermission('user:list')
  async findSimpleList() {
    return this.userService.findSimpleList();
  }

  @Get('by-role/:roleCode')
  async findByRoleCode(@Param('roleCode') roleCode: string) {
    return this.userService.findByRoleCode(roleCode);
  }

  @Get(':id')
  @RequirePermission('user:list')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findById(id);
  }

  @Post()
  @RequirePermission('user:create')
  async create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Put(':id')
  @RequirePermission('user:update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.userService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('user:delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    // Soft delete not implemented for users — just disable instead
    return this.userService.toggleEnabled(id, id);
  }

  @Put(':id/assign-roles')
  @RequirePermission('user:update')
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
  ) {
    return this.userService.assignRoles(id, dto);
  }

  @Put(':id/toggle-enabled')
  @RequirePermission('user:update')
  async toggleEnabled(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.userService.toggleEnabled(id, user.id);
  }

  @Put(':id/reset-password')
  @RequirePermission('user:update')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.userService.resetPassword(id, dto);
  }
}
