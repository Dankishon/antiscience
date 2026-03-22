import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { ResponsesModule } from '../responses/responses.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [AuthModule, ResponsesModule, AdminModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
