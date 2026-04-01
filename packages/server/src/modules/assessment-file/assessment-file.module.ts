import { Module } from '@nestjs/common';
import { AssessmentFileController } from './assessment-file.controller';
import { AssessmentFileService } from './assessment-file.service';

@Module({
  controllers: [AssessmentFileController],
  providers: [AssessmentFileService],
  exports: [AssessmentFileService],
})
export class AssessmentFileModule {}
