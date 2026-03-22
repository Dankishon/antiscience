import { Injectable } from '@nestjs/common';

@Injectable()
export class RandomService {
  next(): number {
    return Math.random();
  }
}
