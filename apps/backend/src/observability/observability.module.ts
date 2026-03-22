import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { RequestMetricsService } from './request-metrics.service';
import { StructuredLoggerService } from './structured-logger.service';

@Module({
  controllers: [MetricsController],
  providers: [RequestMetricsService, StructuredLoggerService],
  exports: [RequestMetricsService, StructuredLoggerService],
})
export class ObservabilityModule {}
