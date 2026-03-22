import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns the health payload', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const payload = controller.getHealth();

    expect(payload.service).toBe('flower-survey-backend');
    expect(payload.database.provider).toBe('postgresql');
  });
});
