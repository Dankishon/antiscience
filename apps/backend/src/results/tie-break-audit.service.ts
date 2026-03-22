import { Injectable } from '@nestjs/common';
import type { ComputeResultAuditLogDto } from './dto/compute-result.dto';

@Injectable()
export class TieBreakAuditService {
  async record(entry: ComputeResultAuditLogDto): Promise<void> {
    void entry;
    // The database-backed writer will replace this stub when Prisma/pg
    // persistence is wired into the backend runtime.
  }
}
