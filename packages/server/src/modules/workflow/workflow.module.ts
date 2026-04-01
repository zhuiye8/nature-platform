import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { TransitionResolver } from './transition.resolver';
import { AssignmentService } from './assignment.service';
import { SimpleHandler } from './handlers/simple.handler';
import { ReviewHandler } from './handlers/review.handler';
import { ParallelReviewHandler } from './handlers/parallel-review.handler';
import { MultiAssigneeHandler } from './handlers/multi-assignee.handler';
import { AutoHandler } from './handlers/auto.handler';

@Module({
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    TransitionResolver,
    AssignmentService,
    SimpleHandler,
    ReviewHandler,
    ParallelReviewHandler,
    MultiAssigneeHandler,
    AutoHandler,
  ],
  exports: [WorkflowService],
})
export class WorkflowModule {}
