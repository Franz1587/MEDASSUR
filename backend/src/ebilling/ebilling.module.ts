import { Module } from '@nestjs/common';
import { EbillingService } from './ebilling.service';
import { EbillingController } from './ebilling.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [EbillingService],
  controllers: [EbillingController],
  exports: [EbillingService],
})
export class EbillingModule {}
