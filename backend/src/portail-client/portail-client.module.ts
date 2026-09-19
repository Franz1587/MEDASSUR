import { Module } from "@nestjs/common";
import { ContratsModule } from "../contrats/contrats.module";
import { SanteModule } from "../sante/sante.module";
import { StatistiquesModule } from "../statistiques/statistiques.module";
import { DocumentsModule } from "../documents/documents.module";
import { AvenantsModule } from "../avenants/avenants.module";
import { FactureProductionModule } from "../facture-production/facture-production.module";
import { PortailClientController } from "./portail-client.controller";

@Module({
  imports: [ContratsModule, SanteModule, StatistiquesModule, DocumentsModule, AvenantsModule, FactureProductionModule],
  controllers: [PortailClientController],
})
export class PortailClientModule {}
