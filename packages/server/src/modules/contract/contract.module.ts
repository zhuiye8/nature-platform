import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractListener } from './contract.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { RecycleModule } from '../recycle/recycle.module';

@Module({
  imports: [WorkflowModule, RecycleModule],
  controllers: [ContractController],
  providers: [ContractService, ContractListener],
  exports: [ContractService],
})
export class ContractModule {}
