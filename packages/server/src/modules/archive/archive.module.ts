import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { ArchiveController } from './archive.controller';
import { ArchiveService } from './archive.service';

@Module({
  imports: [WorkflowModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
  exports: [ArchiveService],
})
export class ArchiveModule {}
