import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { AuthConfigService } from './auth.config';

@Injectable()
export class PasswordService {
  constructor(@Inject(AuthConfigService) private readonly authConfig: AuthConfigService) {}

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.authConfig.argon2Options);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }
}
