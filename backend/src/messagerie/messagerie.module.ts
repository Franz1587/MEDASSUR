import { Module } from "@nestjs/common";
import { MessagerieController } from "./messagerie.controller";
import { MessagerieService } from "./messagerie.service";
import { MessagerieAgentIaService } from "./agent-ia.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { AccordPrealableModule } from "../accord-prealable/accord-prealable.module";
import { SanteModule } from "../sante/sante.module";
import { DocumentsModule } from "../documents/documents.module";
import { RemboursementsModule } from "../remboursements/remboursements.module";

@Module({
  imports: [NotificationsModule, AccordPrealableModule, SanteModule, DocumentsModule, RemboursementsModule],
  controllers: [MessagerieController],
  providers: [MessagerieService, MessagerieAgentIaService],
  // MessagerieAgentIaService exporté (2026-08) — voir demande utilisateur :
  // déclenchement automatique d'une conversation IA depuis
  // PortailMembreController à la création d'une demande Hospitalisation
  // (voir PortailMembreModule, qui importe ce module pour cette raison).
  exports: [MessagerieService, MessagerieAgentIaService],
})
export class MessagerieModule {}
