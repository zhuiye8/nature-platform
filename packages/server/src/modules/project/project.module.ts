import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectListener } from './project.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { RecycleModule } from '../recycle/recycle.module';

@Module({
  imports: [WorkflowModule, RecycleModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectListener],
  exports: [ProjectService],
})
export class ProjectModule {}
