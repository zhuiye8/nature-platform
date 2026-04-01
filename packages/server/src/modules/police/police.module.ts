import { Module } from '@nestjs/common';
import { PoliceController } from './police.controller';
import { PoliceService } from './police.service';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [PoliceController],
  providers: [PoliceService],
  exports: [PoliceService],
})
export class PoliceModule {}
