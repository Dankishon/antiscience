import { HttpStatus, ValidationPipe, type INestApplication } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiErrorException } from './common/api-error.exception';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { createRequestObservabilityMiddleware } from './common/request-observability';
import { assignRequestId } from './common/request-id';
import { applyBackendSecurityHeaders, configureCors } from './common/security';
import { RequestMetricsService } from './observability/request-metrics.service';
import { StructuredLoggerService } from './observability/structured-logger.service';

function formatValidationErrors(errors: ValidationError[]): Array<{
  property: string;
  constraints: string[];
  children?: unknown;
}> {
  return errors.map((error) => ({
    property: error.property,
    constraints: error.constraints ? Object.values(error.constraints) : [],
    children: error.children && error.children.length > 0 ? formatValidationErrors(error.children) : undefined,
  }));
}

export function configureApp(app: INestApplication): void {
  const httpServer = app.getHttpAdapter().getInstance();
  if (typeof httpServer.disable === 'function') {
    httpServer.disable('x-powered-by');
  }

  const requestMetrics = app.get(RequestMetricsService);
  const structuredLogger = app.get(StructuredLoggerService);

  app.setGlobalPrefix('api');
  configureCors(app);
  app.use(assignRequestId);
  app.use(applyBackendSecurityHeaders);
  app.use(createRequestObservabilityMiddleware(requestMetrics, structuredLogger));
  app.useGlobalFilters(new ApiExceptionFilter(structuredLogger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) =>
        new ApiErrorException(
          HttpStatus.BAD_REQUEST,
          'validation_error',
          'Request validation failed.',
          formatValidationErrors(errors),
        ),
    }),
  );
}
