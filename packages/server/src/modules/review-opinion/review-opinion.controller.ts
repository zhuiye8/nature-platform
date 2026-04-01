import { Controller, Get, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReviewOpinionService } from './review-opinion.service';

@Controller('review-opinion')
@UseGuards(JwtAuthGuard)
export class ReviewOpinionController {
  constructor(private readonly reviewOpinionService: ReviewOpinionService) {}

  @Get('templates')
  async getTemplates(
    @Query('nodeKey') nodeKey: string,
    @Query('actionType') actionType?: string,
    @Query('slotKey') slotKey?: string,
  ) {
    return this.reviewOpinionService.getTemplates(nodeKey, slotKey, actionType);
  }

  @Get(':projectRegisterId')
  async listByProject(
    @Param('projectRegisterId', ParseIntPipe) projectRegisterId: number,
  ) {
    return this.reviewOpinionService.listByProject(projectRegisterId);
  }
}
