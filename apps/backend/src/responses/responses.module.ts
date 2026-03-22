import { Module } from '@nestjs/common';
import { ResultsModule } from '../results/results.module';
import { ResponsesController } from './responses.controller';
import { ResponsesService } from './responses.service';
import { ResponsesStoreService } from './responses.store';

@Module({
  imports: [ResultsModule],
  controllers: [ResponsesController],
  providers: [ResponsesService, ResponsesStoreService],
  exports: [ResponsesStoreService],
})
export class ResponsesModule {}
