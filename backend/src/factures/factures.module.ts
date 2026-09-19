import { Module } from "@nestjs/common";
import { FacturesService } from "./factures.service";
import { FacturesController } from "./factures.controller";
import { SanteModule } from "../sante/sante.module";
import { ReglementPrestataireModule } from "../reglement-prestataire/reglement-prestataire.module";

@Module({
  imports: [SanteModule, ReglementPrestataireModule],
  providers: [FacturesService],
  controllers: [FacturesController],
  exports: [FacturesService],
})
export class FacturesModule {}
