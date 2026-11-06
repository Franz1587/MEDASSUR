import { Module } from "@nestjs/common";
import { ImportLibreService } from "./import-libre.service";
import { ImportLibreController } from "./import-libre.controller";
import { SanteModule } from "../sante/sante.module";
import { FacturesModule } from "../factures/factures.module";
import { PrestatairesModule } from "../prestataires/prestataires.module";
import { MouvementsModule } from "../mouvements/mouvements.module";
import { ImportClasseurService } from "./import-classeur.service";

@Module({
  imports: [SanteModule, FacturesModule, PrestatairesModule, MouvementsModule],
  providers: [ImportLibreService, ImportClasseurService],
  controllers: [ImportLibreController],
})
export class ImportLibreModule {}
