import { Module } from '@nestjs/common';
import { PoliceController } from './police.controller';
import { PoliceService } from './police.service';
import { PoliceListener } from './police.listener';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [PoliceController],
  providers: [PoliceService, PoliceListener],
  exports: [PoliceService],
})
export class PoliceModule {}
