import { Module } from "@nestjs/common";
import { ReglementComptableService } from "./reglement-comptable.service";
import { ReglementComptableController } from "./reglement-comptable.controller";

@Module({
  providers: [ReglementComptableService],
  controllers: [ReglementComptableController],
  exports: [ReglementComptableService],
})
export class ReglementComptableModule {}
