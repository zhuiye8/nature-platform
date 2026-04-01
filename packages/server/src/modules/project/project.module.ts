import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectListener } from './project.listener';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectListener],
  exports: [ProjectService],
})
export class ProjectModule {}
