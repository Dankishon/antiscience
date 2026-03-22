import { HttpException, type HttpStatus } from '@nestjs/common';

export class ApiErrorException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super({ code, message, details }, status);
  }
}
