import { randomUUID } from 'node:crypto';

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

type NextFunction = () => void;

export function assignRequestId(req: RequestLike, res: ResponseLike, next: NextFunction): void {
  const headerValue = req.headers?.['x-request-id'];
  const requestId =
    typeof headerValue === 'string' && headerValue.trim().length > 0 ? headerValue : randomUUID();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

export function getRequestId(req: RequestLike | undefined): string {
  if (req?.requestId && req.requestId.trim().length > 0) {
    return req.requestId;
  }

  const headerValue = req?.headers?.['x-request-id'];
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue;
  }

  return randomUUID();
}
