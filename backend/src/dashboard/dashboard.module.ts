import { Module } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { DashboardController } from "./dashboard.controller";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";

// Tableau de bord "Pilotage Assurance" (2026-08) — voir demande
// utilisateur : "le tableau de bord ne doit pas être codé en dur mais
// interactif et réel."
@Module({
  imports: [ParametresEntrepriseModule],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
