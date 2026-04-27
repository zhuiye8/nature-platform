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
import { ExpenseService } from './expense.service';
import {
  CreateExpenseDto,
  QueryExpenseDto,
  ReviewExpenseDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

@Controller('expense')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ExpenseController {
  constructor(private readonly service: ExpenseService) {}

  @Get('page')
  @RequirePermission('expense:request')
  async findPage(
    @Query() query: QueryExpenseDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.findPage(query, user.id);
  }

  @Get(':id')
  @RequirePermission('expense:request')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.findById(id, user.id);
  }

  @Post()
  @RequirePermission('expense:request')
  async create(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermission('expense:request')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/submit')
  @RequirePermission('expense:request')
  async submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.submit(id, user.id);
  }

  // 审核 endpoint: 部门负责人 + 财务都用同一个，service 内根据 currentNode 校验权限
  @Post(':id/review')
  @RequirePermission('expense:request')   // 进入后由 service 按节点校验 dept_manager / finance
  async review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewExpenseDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.review(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermission('expense:request')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.service.remove(id, user.id);
  }
}
