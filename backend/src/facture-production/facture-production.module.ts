import { Module } from "@nestjs/common";
import { FactureProductionService } from "./facture-production.service";
import { FactureProductionController } from "./facture-production.controller";

@Module({
  providers: [FactureProductionService],
  controllers: [FactureProductionController],
  exports: [FactureProductionService],
})
export class FactureProductionModule {}
