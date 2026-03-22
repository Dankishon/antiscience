import { Module } from '@nestjs/common';
import { RandomService } from './random.service';
import { ResultService } from './result.service';
import { SurveyCatalogService } from './survey-catalog.service';
import { TieBreakAuditService } from './tie-break-audit.service';

@Module({
  providers: [RandomService, ResultService, SurveyCatalogService, TieBreakAuditService],
  exports: [ResultService],
})
export class ResultsModule {}
