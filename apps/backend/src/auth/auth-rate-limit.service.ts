import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiErrorException } from '../common/api-error.exception';
import type { RateLimitPolicy } from './auth.config';

interface RateLimitBucket {
  attempts: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(scope: 'login' | 'register', identity: string, policy: RateLimitPolicy): void {
    const now = Date.now();
    const key = `${scope}:${identity}`;
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, {
        attempts: 1,
        resetAt: now + policy.windowMs,
      });
      return;
    }

    if (current.attempts >= policy.maxAttempts) {
      throw new ApiErrorException(
        HttpStatus.TOO_MANY_REQUESTS,
        'rate_limit_exceeded',
        `Too many ${scope} attempts. Please retry later.`,
        {
          scope,
          retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
        },
      );
    }

    current.attempts += 1;
    this.buckets.set(key, current);
  }
}
