import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { ClientsModule } from "./clients/clients.module";
import { CompagniesModule } from "./compagnies/compagnies.module";
import { ContratsModule } from "./contrats/contrats.module";
import { DevisModule } from "./devis/devis.module";
import { RenouvellementsModule } from "./renouvellements/renouvellements.module";
import { AvenantsModule } from "./avenants/avenants.module";
import { ResiliationsModule } from "./resiliations/resiliations.module";
import { SinistresModule } from "./sinistres/sinistres.module";
import { SanteModule } from "./sante/sante.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { TresorerieModule } from "./tresorerie/tresorerie.module";
import { RecouvrementModule } from "./recouvrement/recouvrement.module";
import { CrmModule } from "./crm/crm.module";
import { IardModule } from "./iard/iard.module";
import { VieModule } from "./vie/vie.module";
import { FlotteModule } from "./flotte/flotte.module";
import { ComptabiliteModule } from "./comptabilite/comptabilite.module";
import { GedModule } from "./ged/ged.module";
import { AppelOffresModule } from "./appel-offres/appel-offres.module";
import { CotationModule } from "./cotation/cotation.module";
import { PrestatairesModule } from "./prestataires/prestataires.module";
import { AccordPrealableModule } from "./accord-prealable/accord-prealable.module";
import { FondsDeRoulementModule } from "./fonds-de-roulement/fonds-de-roulement.module";
import { HonorairesModule } from "./honoraires/honoraires.module";
import { FraudeModule } from "./fraude/fraude.module";
import { ReglementPrestataireModule } from "./reglement-prestataire/reglement-prestataire.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AuditModule,
    ClientsModule,
    CompagniesModule,
    ContratsModule,
    DevisModule,
    RenouvellementsModule,
    AvenantsModule,
    ResiliationsModule,
    SinistresModule,
    SanteModule,
    CommissionsModule,
    TresorerieModule,
    RecouvrementModule,
    CrmModule,
    IardModule,
    VieModule,
    FlotteModule,
    ComptabiliteModule,
    GedModule,
    AppelOffresModule,
    CotationModule,
    PrestatairesModule,
    AccordPrealableModule,
    FondsDeRoulementModule,
    HonorairesModule,
    FraudeModule,
    ReglementPrestataireModule,
    NotificationsModule,
  ],
})
export class AppModule {}
