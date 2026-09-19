import { Module } from "@nestjs/common";
import { PortailPrestataireController } from "./portail-prestataire.controller";
import { FacturesModule } from "../factures/factures.module";
import { DocumentsModule } from "../documents/documents.module";
import { AccordPrealableModule } from "../accord-prealable/accord-prealable.module";
import { RelevesPrestataireModule } from "../releves-prestataire/releves-prestataire.module";
import { AuditModule } from "../audit/audit.module";
import { SanteModule } from "../sante/sante.module";
import { PrescriptionsModule } from "../prescriptions/prescriptions.module";
import { MessagerieModule } from "../messagerie/messagerie.module";

@Module({
  imports: [FacturesModule, DocumentsModule, AccordPrealableModule, RelevesPrestataireModule, AuditModule, SanteModule, PrescriptionsModule, MessagerieModule],
  controllers: [PortailPrestataireController],
})
export class PortailPrestataireModule {}
