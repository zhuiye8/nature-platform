import { Module } from '@nestjs/common';
import { ReviewOpinionController } from './review-opinion.controller';
import { ReviewOpinionService } from './review-opinion.service';

@Module({
  controllers: [ReviewOpinionController],
  providers: [ReviewOpinionService],
  exports: [ReviewOpinionService],
})
export class ReviewOpinionModule {}
