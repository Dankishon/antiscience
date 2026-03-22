import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@flower-survey/shared';

type LogLevel = 'error' | 'info' | 'warn';

@Injectable()
export class StructuredLoggerService {
  private readonly enabled =
    (process.env.ENABLE_STRUCTURED_LOGS ?? (process.env.NODE_ENV === 'test' ? 'false' : 'true')) ===
    'true';

  info(event: string, payload: Record<string, unknown>) {
    this.emit('info', event, payload);
  }

  warn(event: string, payload: Record<string, unknown>) {
    this.emit('warn', event, payload);
  }

  error(event: string, payload: Record<string, unknown>) {
    this.emit('error', event, payload);
  }

  private emit(level: LogLevel, event: string, payload: Record<string, unknown>) {
    if (!this.enabled) {
      return;
    }

    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      service: `${APP_NAME}-backend`,
      level,
      event,
      ...payload,
    });

    if (level === 'error') {
      console.error(line);
      return;
    }

    if (level === 'warn') {
      console.warn(line);
      return;
    }

    console.log(line);
  }
}
