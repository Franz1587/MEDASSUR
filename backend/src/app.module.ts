import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TenantContextInterceptor } from "./tenant/tenant-context.interceptor";
import { PrismaModule } from "./prisma/prisma.module";
import { StorageModule } from "./storage/storage.module";
import { MessagingModule } from "./messaging/messaging.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { IdempotenceModule } from "./idempotence/idempotence.module";
import { ClientsModule } from "./clients/clients.module";
import { CompagniesModule } from "./compagnies/compagnies.module";
import { ContratsModule } from "./contrats/contrats.module";
import { ImportModule } from "./import/import.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { RenouvellementsModule } from "./renouvellements/renouvellements.module";
import { AvenantsModule } from "./avenants/avenants.module";
import { QuittancesLibresModule } from "./quittances-libres/quittances-libres.module";
import { ResiliationsModule } from "./resiliations/resiliations.module";
import { SinistresModule } from "./sinistres/sinistres.module";
import { SanteModule } from "./sante/sante.module";
import { CommissionsModule } from "./commissions/commissions.module";
import { TresorerieModule } from "./tresorerie/tresorerie.module";
import { RecouvrementModule } from "./recouvrement/recouvrement.module";
import { CrmModule } from "./crm/crm.module";
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
import { LettrageModule } from "./lettrage/lettrage.module";
import { ModelesCarteModule } from "./modeles-carte/modeles-carte.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { MessagerieModule } from "./messagerie/messagerie.module";
import { GarantieCatalogueModule } from "./garantie-catalogue/garantie-catalogue.module";
import { DocumentsModule } from "./documents/documents.module";
import { ParametresEntrepriseModule } from "./parametres-entreprise/parametres-entreprise.module";
import { IaAssistantModule } from "./ia-assistant/ia-assistant.module";
import { ComptesMobileModule } from "./comptes-mobile/comptes-mobile.module";
import { ActesMedicauxModule } from "./actes-medicaux/actes-medicaux.module";
import { LettresClesModule } from "./lettres-cles/lettres-cles.module";
import { FacturesModule } from "./factures/factures.module";
import { RemboursementsModule } from "./remboursements/remboursements.module";
import { CommunicationsModule } from "./communications/communications.module";
import { BanquesModule } from "./banques/banques.module";
import { AgencesModule } from "./agences/agences.module";
import { ReglementComptableModule } from "./reglement-comptable/reglement-comptable.module";
import { FactureProductionModule } from "./facture-production/facture-production.module";
import { CourrierModule } from "./courrier/courrier.module";
import { UsersModule } from "./users/users.module";
import { SocietesModule } from "./societes/societes.module";
import { StatistiquesModule } from "./statistiques/statistiques.module";
import { RoleTemplatesModule } from "./role-templates/role-templates.module";
import { PortailClientModule } from "./portail-client/portail-client.module";
import { DemandesClientModule } from "./demandes-client/demandes-client.module";
import { ReglesConsignesModule } from "./regles-consignes/regles-consignes.module";
import { PortailClientUtilisateursModule } from "./portail-client-utilisateurs/portail-client-utilisateurs.module";
import { BordereauxModule } from "./bordereaux/bordereaux.module";
import { EncaissementsModule } from "./encaissements/encaissements.module";
import { PortailMembreModule } from "./portail-membre/portail-membre.module";
import { PortailPrestataireModule } from "./portail-prestataire/portail-prestataire.module";
import { MedecinsModule } from "./medecins/medecins.module";
import { PortailMedecinModule } from "./portail-medecin/portail-medecin.module";
import { CodesAffectionModule } from "./codes-affection/codes-affection.module";
import { AbonnementModule } from "./abonnement/abonnement.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    MessagingModule,
    AuthModule,
    AuditModule,
    ClientsModule,
    CompagniesModule,
    ContratsModule,
    ImportModule,
    DashboardModule,
    RenouvellementsModule,
    AvenantsModule,
    QuittancesLibresModule,
    ResiliationsModule,
    SinistresModule,
    SanteModule,
    CommissionsModule,
    TresorerieModule,
    RecouvrementModule,
    CrmModule,
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
    LettrageModule,
    ModelesCarteModule,
    NotificationsModule,
    MessagerieModule,
    GarantieCatalogueModule,
    DocumentsModule,
    ParametresEntrepriseModule,
    IaAssistantModule,
    ComptesMobileModule,
    ActesMedicauxModule,
    LettresClesModule,
    FacturesModule,
    RemboursementsModule,
    CommunicationsModule,
    BanquesModule,
    AgencesModule,
    ReglementComptableModule,
    FactureProductionModule,
    CourrierModule,
    UsersModule,
    SocietesModule,
    StatistiquesModule,
    RoleTemplatesModule,
    PortailClientModule,
    DemandesClientModule,
    ReglesConsignesModule,
    PortailClientUtilisateursModule,
    BordereauxModule,
    EncaissementsModule,
    PortailMembreModule,
    PortailPrestataireModule,
    MedecinsModule,
    PortailMedecinModule,
    CodesAffectionModule,
    AbonnementModule,
    IdempotenceModule,
  ],
  providers: [
    // Isolation multi-tenant (2026-09, Phase 2) — voir tenant-context.ts.
    // Global : alimente TenantContext.societeId pour CHAQUE requête HTTP,
    // avant que le moindre service métier ne touche à Prisma.
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
