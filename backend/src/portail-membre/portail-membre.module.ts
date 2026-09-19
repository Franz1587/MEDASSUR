import { Module } from "@nestjs/common";
import { PortailMembreController } from "./portail-membre.controller";
import { SanteModule } from "../sante/sante.module";
import { AccordPrealableModule } from "../accord-prealable/accord-prealable.module";
import { DocumentsModule } from "../documents/documents.module";
import { MessagerieModule } from "../messagerie/messagerie.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DelegationsFamilleService } from "./delegations-famille.service";
import { CarnetSanteService } from "./carnet-sante.service";

@Module({
  imports: [SanteModule, AccordPrealableModule, DocumentsModule, MessagerieModule, NotificationsModule],
  controllers: [PortailMembreController],
  providers: [DelegationsFamilleService, CarnetSanteService],
})
export class PortailMembreModule {}
