import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { MeModule } from './me/me.module';
import { ObservabilityModule } from './observability/observability.module';
import { ResponsesModule } from './responses/responses.module';
import { SurveysModule } from './surveys/surveys.module';

@Module({
  imports: [AuthModule, SurveysModule, ResponsesModule, AdminModule, MeModule, ObservabilityModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
