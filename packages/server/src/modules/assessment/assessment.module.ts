import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { AssessmentListener } from './assessment.listener';

@Module({
  imports: [WorkflowModule],
  controllers: [AssessmentController],
  providers: [AssessmentService, AssessmentListener],
  exports: [AssessmentService],
})
export class AssessmentModule {}
