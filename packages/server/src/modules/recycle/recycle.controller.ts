import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { RecycleService } from './recycle.service';
import { QueryRecycleDto } from './dto/recycle.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

@Controller('recycle')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RecycleController {
  constructor(private readonly recycleService: RecycleService) {}

  @Get('page')
  @RequirePermission('recycle:list')
  async findPage(@Query() query: QueryRecycleDto) {
    return this.recycleService.findPage(query);
  }

  @Post('restore/:id')
  @RequirePermission('recycle:restore')
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.recycleService.restore(id);
  }

  @Delete(':id')
  @RequirePermission('recycle:delete')
  async permanentDelete(@Param('id', ParseIntPipe) id: number) {
    return this.recycleService.permanentDelete(id);
  }
}
