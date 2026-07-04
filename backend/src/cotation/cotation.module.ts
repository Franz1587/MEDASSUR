import { Module } from "@nestjs/common";
import { CotationService } from "./cotation.service";
import { CotationController } from "./cotation.controller";

@Module({
  providers: [CotationService],
  controllers: [CotationController],
})
export class CotationModule {}
