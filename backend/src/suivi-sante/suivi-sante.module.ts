import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { DocumentsModule } from "../documents/documents.module";
import { SuiviSanteService } from "./suivi-sante.service";
import { SuiviSanteMedecinController, SuiviSanteMembreController, SuiviSantePrestataireController } from "./suivi-sante.controller";

@Module({
  imports: [NotificationsModule, DocumentsModule],
  controllers: [SuiviSanteMembreController, SuiviSanteMedecinController, SuiviSantePrestataireController],
  providers: [SuiviSanteService],
})
export class SuiviSanteModule {}
