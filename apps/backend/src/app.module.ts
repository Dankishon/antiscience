import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { ResultsModule } from './results/results.module';

@Module({
  imports: [ResultsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
