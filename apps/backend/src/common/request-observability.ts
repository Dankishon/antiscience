import type { NextFunction, Request, Response } from 'express';
import { getRequestId } from './request-id';
import type { RequestMetricsService } from '../observability/request-metrics.service';
import type { StructuredLoggerService } from '../observability/structured-logger.service';

export function createRequestObservabilityMiddleware(
  metrics: RequestMetricsService,
  logger: StructuredLoggerService,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    const path = req.originalUrl ?? req.url;
    let handled = false;

    const recordCompletion = () => {
      if (handled) {
        return;
      }

      handled = true;
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const requestId = getRequestId(req);
      metrics.recordRequest({
        method: req.method,
        path,
        statusCode: res.statusCode,
        latencyMs,
        requestId,
      });

      logger.info('http_request_completed', {
        request_id: requestId,
        method: req.method,
        path,
        status_code: res.statusCode,
        latency_ms: Math.round(latencyMs * 100) / 100,
        error: res.statusCode >= 400,
      });
    };

    res.on('finish', recordCompletion);
    res.on('close', recordCompletion);
    next();
  };
}
