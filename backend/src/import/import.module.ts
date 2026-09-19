import { Module } from "@nestjs/common";
import { ImportService } from "./import.service";
import { ImportController } from "./import.controller";
import { SanteModule } from "../sante/sante.module";
import { FacturesModule } from "../factures/factures.module";
import { AccordPrealableModule } from "../accord-prealable/accord-prealable.module";
import { PrestatairesModule } from "../prestataires/prestataires.module";

// Onglet Import (Système) — 2026-08 — voir demande utilisateur : "pour
// permettre aux sociétés d'assurance qui voudraient changer de logiciel
// mais commencer à utiliser MedAssur." Réutilise SanteService/
// FacturesService/AccordPrealableService/PrestatairesService (mêmes
// moteurs que la saisie manuelle) plutôt que de dupliquer leur logique
// métier.
@Module({
  imports: [SanteModule, FacturesModule, AccordPrealableModule, PrestatairesModule],
  providers: [ImportService],
  controllers: [ImportController],
})
export class ImportModule {}
