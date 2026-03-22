import { Module } from '@nestjs/common';
import { ResultsModule } from '../results/results.module';
import { SurveysController } from './surveys.controller';
import { SurveysService } from './surveys.service';

@Module({
  imports: [ResultsModule],
  controllers: [SurveysController],
  providers: [SurveysService],
})
export class SurveysModule {}
