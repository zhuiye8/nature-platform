import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { SubmitReportDto, QueryReportDto } from './dto/report.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('report')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('page')
  @RequirePermission('report:list')
  async findPage(
    @Query() query: QueryReportDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.reportService.findPage(query, user.id);
  }

  @Get(':projectRegisterId')
  @RequirePermission('report:list')
  async getReportDetail(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.reportService.getReportDetail(projectRegisterId);
  }

  @Post('submit')
  @RequirePermission('report:submit')
  async submitReport(
    @Body() dto: SubmitReportDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.reportService.submitReport(dto, user.id);
  }
}
