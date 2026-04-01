import { Module } from '@nestjs/common';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';
import { ContractListener } from './contract.listener';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [WorkflowModule],
  controllers: [ContractController],
  providers: [ContractService, ContractListener],
  exports: [ContractService],
})
export class ContractModule {}
