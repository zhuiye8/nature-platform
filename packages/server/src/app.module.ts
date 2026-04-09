import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ContractModule } from './modules/contract/contract.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ProjectModule } from './modules/project/project.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PoliceModule } from './modules/police/police.module';
import { RecycleModule } from './modules/recycle/recycle.module';
import { PlatformModule } from './modules/platform/platform.module';
import { UserModule } from './modules/user/user.module';
import { RoleModule } from './modules/role/role.module';
import { PartnerModule } from './modules/partner/partner.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ReportModule } from './modules/report/report.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { FileModule } from './modules/file/file.module';
import { ReviewOpinionModule } from './modules/review-opinion/review-opinion.module';
import { AssessmentFileModule } from './modules/assessment-file/assessment-file.module';
import { CompileFileModule } from './modules/compile-file/compile-file.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    CustomerModule,
    ContractModule,
    WorkflowModule,
    ProjectModule,
    NotificationModule,
    PoliceModule,
    RecycleModule,
    PlatformModule,
    UserModule,
    RoleModule,
    PartnerModule,
    AssessmentModule,
    ReportModule,
    ArchiveModule,
    FileModule,
    ReviewOpinionModule,
    AssessmentFileModule,
    CompileFileModule,
  ],
})
export class AppModule {}
