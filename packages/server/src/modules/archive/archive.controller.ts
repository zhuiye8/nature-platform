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
import { ArchiveService } from './archive.service';
import { SubmitArchiveDto, QueryArchiveDto } from './dto/archive.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('archive')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get('page')
  @RequirePermission('archive:list')
  async findPage(
    @Query() query: QueryArchiveDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.archiveService.findPage(query, user.id);
  }

  @Get(':projectRegisterId')
  @RequirePermission('archive:list')
  async findByProjectId(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.archiveService.findByProjectId(projectRegisterId);
  }

  @Post('submit')
  @RequirePermission('archive:submit')
  async submit(
    @Body() dto: SubmitArchiveDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.archiveService.submit(dto, user.id);
  }
}
