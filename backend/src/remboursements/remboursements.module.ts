import { Module } from "@nestjs/common";
import { RemboursementsService } from "./remboursements.service";
import { RemboursementsController } from "./remboursements.controller";
import { SanteModule } from "../sante/sante.module";
import { ReglementPrestataireModule } from "../reglement-prestataire/reglement-prestataire.module";

@Module({
  imports: [SanteModule, ReglementPrestataireModule],
  providers: [RemboursementsService],
  controllers: [RemboursementsController],
  exports: [RemboursementsService],
})
export class RemboursementsModule {}
