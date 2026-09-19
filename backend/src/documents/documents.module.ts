import { Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { DocumentsController } from "./documents.controller";
import { DocumentSignatureService } from "./document-signature.service";
import { VerificationPubliqueController } from "./verification-publique.controller";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";
import { StatistiquesModule } from "../statistiques/statistiques.module";
import { SanteModule } from "../sante/sante.module";
import { BordereauxModule } from "../bordereaux/bordereaux.module";
import { CotationModule } from "../cotation/cotation.module";
import { CourrierModule } from "../courrier/courrier.module";
import { CrmModule } from "../crm/crm.module";
import { ReglementComptableModule } from "../reglement-comptable/reglement-comptable.module";
import { ReglementPrestataireModule } from "../reglement-prestataire/reglement-prestataire.module";
import { RenouvellementsModule } from "../renouvellements/renouvellements.module";
import { AccordPrealableModule } from "../accord-prealable/accord-prealable.module";
import { PrestatairesModule } from "../prestataires/prestataires.module";

@Module({
  imports: [
    ParametresEntrepriseModule, StatistiquesModule, SanteModule, BordereauxModule,
    CotationModule, CourrierModule, CrmModule, ReglementComptableModule, ReglementPrestataireModule,
    RenouvellementsModule, AccordPrealableModule, PrestatairesModule,
  ],
  providers: [DocumentsService, DocumentSignatureService],
  controllers: [DocumentsController, VerificationPubliqueController],
  exports: [DocumentsService, DocumentSignatureService],
})
export class DocumentsModule {}
