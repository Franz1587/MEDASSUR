import { Module } from "@nestjs/common";
import { ReglementPrestataireService } from "./reglement-prestataire.service";
import { ReglementPrestataireController } from "./reglement-prestataire.controller";

@Module({
  providers: [ReglementPrestataireService],
  controllers: [ReglementPrestataireController],
  exports: [ReglementPrestataireService],
})
export class ReglementPrestataireModule {}
