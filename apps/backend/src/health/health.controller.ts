import { Controller, Get, Inject } from '@nestjs/common';
import type { ApiHealthResponse } from '@flower-survey/shared';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  getHealth(): ApiHealthResponse {
    return this.healthService.getStatus();
  }
}
