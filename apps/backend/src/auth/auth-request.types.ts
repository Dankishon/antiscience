import type { Request } from 'express';
import type { AuthUserDto } from './auth.types';

export interface AuthenticatedRequest extends Request {
  authUser?: AuthUserDto;
  requestId?: string;
}
