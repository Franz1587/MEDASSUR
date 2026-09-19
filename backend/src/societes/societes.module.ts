import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";
import { SocietesService } from "./societes.service";
import { SocietesController } from "./societes.controller";
import { PlansAbonnementService } from "./plans-abonnement.service";
import { PlansAbonnementController } from "./plans-abonnement.controller";
import { SocieteUsersService } from "./societe-users.service";
import { SocieteUsersController } from "./societe-users.controller";
import { FactureAbonnementService } from "./facture-abonnement.service";
import { FactureAbonnementController } from "./facture-abonnement.controller";
import { PerformanceService } from "./performance.service";
import { PerformanceController } from "./performance.controller";
import { TarificationService } from "./tarification.service";
import { TarificationController } from "./tarification.controller";
import { RubriqueFacturationService } from "./rubrique-facturation.service";
import { RubriqueFacturationController } from "./rubrique-facturation.controller";

@Module({
  imports: [AuthModule, AuditModule, ParametresEntrepriseModule],
  providers: [SocietesService, PlansAbonnementService, SocieteUsersService, FactureAbonnementService, PerformanceService, TarificationService, RubriqueFacturationService],
  controllers: [SocietesController, PlansAbonnementController, SocieteUsersController, FactureAbonnementController, PerformanceController, TarificationController, RubriqueFacturationController],
})
export class SocietesModule {}
