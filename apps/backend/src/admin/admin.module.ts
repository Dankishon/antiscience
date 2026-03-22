import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResponsesModule } from '../responses/responses.module';
import { ResultsModule } from '../results/results.module';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminContentStoreService } from './admin-content.store';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [AuthModule, ResponsesModule, ResultsModule],
  controllers: [AdminController],
  providers: [AdminAnalyticsService, AdminContentStoreService, AdminService, AuditLogService],
  exports: [AdminContentStoreService, AuditLogService],
})
export class AdminModule {}
