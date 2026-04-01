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
import { AssessmentService } from './assessment.service';
import { SubmitAssessmentDto, QueryAssessmentDto } from './dto/assessment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('assessment')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('page')
  @RequirePermission('assessment:view')
  async findPage(
    @Query() query: QueryAssessmentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.assessmentService.findPage(query, user.id);
  }

  @Get('project-detail/:projectRegisterId')
  @RequirePermission('assessment:view')
  async getProjectDetail(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.assessmentService.getProjectDetail(projectRegisterId);
  }

  @Get('progress/:projectRegisterId')
  @RequirePermission('assessment:view')
  async getProgress(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.assessmentService.getProgress(projectRegisterId);
  }

  @Get('review-status/:projectRegisterId')
  @RequirePermission('assessment:view')
  async getReviewStatus(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.assessmentService.getReviewStatus(projectRegisterId);
  }

  @Post('submit')
  @RequirePermission('assessment:submit')
  async submitMyPart(
    @Body() dto: SubmitAssessmentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.assessmentService.submitMyPart(dto, user.id);
  }

  @Post('initiate-review/:projectRegisterId')
  @RequirePermission('assessment:start_qr')
  async initiateQualityReview(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.assessmentService.initiateQualityReview(projectRegisterId, user.id);
  }

  @Post('resubmit/:projectRegisterId')
  @RequirePermission('assessment:submit')
  async resubmitAssessmentResult(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
    @CurrentUser() user: { id: number },
  ) {
    return this.assessmentService.resubmitAssessmentResult(projectRegisterId, user.id);
  }
}
