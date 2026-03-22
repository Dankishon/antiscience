import { Injectable } from '@nestjs/common';
import type { RequestMetricRecord } from './observability.types';

interface MetricCounters {
  completions: number;
  errors: number;
  clientErrors: number;
  serverErrors: number;
}

interface LatencySnapshot {
  count: number;
  average: number;
  min: number | null;
  max: number | null;
}

@Injectable()
export class RequestMetricsService {
  private readonly startedAt = new Date().toISOString();
  private counters: MetricCounters = {
    completions: 0,
    errors: 0,
    clientErrors: 0,
    serverErrors: 0,
  };
  private latencyCount = 0;
  private latencyTotalMs = 0;
  private latencyMinMs: number | null = null;
  private latencyMaxMs: number | null = null;
  private lastRequest: RequestMetricRecord | null = null;

  recordRequest(record: RequestMetricRecord): void {
    const roundedLatencyMs = Math.round(record.latencyMs * 100) / 100;

    this.counters.completions += 1;
    if (record.statusCode >= 400) {
      this.counters.errors += 1;
    }
    if (record.statusCode >= 400 && record.statusCode < 500) {
      this.counters.clientErrors += 1;
    }
    if (record.statusCode >= 500) {
      this.counters.serverErrors += 1;
    }

    this.latencyCount += 1;
    this.latencyTotalMs += roundedLatencyMs;
    this.latencyMinMs =
      this.latencyMinMs === null ? roundedLatencyMs : Math.min(this.latencyMinMs, roundedLatencyMs);
    this.latencyMaxMs =
      this.latencyMaxMs === null ? roundedLatencyMs : Math.max(this.latencyMaxMs, roundedLatencyMs);
    this.lastRequest = {
      ...record,
      latencyMs: roundedLatencyMs,
    };
  }

  snapshot() {
    const latency: LatencySnapshot = {
      count: this.latencyCount,
      average:
        this.latencyCount > 0
          ? Math.round((this.latencyTotalMs / this.latencyCount) * 100) / 100
          : 0,
      min: this.latencyMinMs,
      max: this.latencyMaxMs,
    };

    return {
      startedAt: this.startedAt,
      generatedAt: new Date().toISOString(),
      requests: {
        ...this.counters,
      },
      latencyMs: latency,
      lastRequest: this.lastRequest,
    };
  }
}
