import { Module } from "@nestjs/common";
import { AppelOffresService } from "./appel-offres.service";
import { AppelOffresController } from "./appel-offres.controller";
import { AnalysePropositionService } from "./analyse-proposition.service";
import { CotationModule } from "../cotation/cotation.module";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";

@Module({
  imports: [CotationModule, ParametresEntrepriseModule],
  providers: [AppelOffresService, AnalysePropositionService],
  controllers: [AppelOffresController],
  exports: [AppelOffresService],
})
export class AppelOffresModule {}
