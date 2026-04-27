import { Module } from '@nestjs/common';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';
import { ExpenseListener } from './expense.listener';
import { WorkflowModule } from '../workflow/workflow.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WorkflowModule, NotificationModule],
  controllers: [ExpenseController],
  providers: [ExpenseService, ExpenseListener],
  exports: [ExpenseService],
})
export class ExpenseModule {}
