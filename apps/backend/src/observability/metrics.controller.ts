import { Controller, Get, Inject } from '@nestjs/common';
import { RequestMetricsService } from './request-metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(RequestMetricsService)
    private readonly requestMetrics: RequestMetricsService,
  ) {}

  @Get()
  getMetrics() {
    return this.requestMetrics.snapshot();
  }
}
