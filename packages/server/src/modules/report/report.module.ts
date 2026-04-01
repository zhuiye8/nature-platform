import { Module } from '@nestjs/common';
import { WorkflowModule } from '../workflow/workflow.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportListener } from './report.listener';

@Module({
  imports: [WorkflowModule],
  controllers: [ReportController],
  providers: [ReportService, ReportListener],
  exports: [ReportService],
})
export class ReportModule {}
