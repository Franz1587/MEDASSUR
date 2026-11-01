import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SuiviSanteService } from "./suivi-sante.service";
import { SuiviSanteMedecinController, SuiviSanteMembreController, SuiviSantePrestataireController } from "./suivi-sante.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [SuiviSanteMembreController, SuiviSanteMedecinController, SuiviSantePrestataireController],
  providers: [SuiviSanteService],
})
export class SuiviSanteModule {}
