import { describe, expect, it } from 'vitest';
import { ApiErrorException } from '../common/api-error.exception';
import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  it('throws after the configured number of attempts within the same window', () => {
    const service = new AuthRateLimitService();
    const policy = {
      maxAttempts: 2,
      windowMs: 60_000,
    };

    service.consume('login', '127.0.0.1:user@example.com', policy);
    service.consume('login', '127.0.0.1:user@example.com', policy);

    expect(() => service.consume('login', '127.0.0.1:user@example.com', policy)).toThrowError(
      ApiErrorException,
    );
  });
});
