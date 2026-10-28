import { lazy } from "react";
import type { View } from "@/layout/navConfig";

const RoleDashboard = lazy(() => import("@/features/dashboard/RoleDashboard"));
const SanteAdminConsole = lazy(() => import("@/features/sante/SanteAdminConsole"));
const CrmView = lazy(() => import("@/features/crm"));
const ClientsView = lazy(() => import("@/features/clients"));
const CompagniesView = lazy(() => import("@/features/compagnies"));
const AutoGestionView = lazy(() => import("@/features/autogestion"));
const AppelOffresView = lazy(() => import("@/features/appel-offres"));
const CotationView = lazy(() => import("@/features/cotation"));
const ContratsView = lazy(() => import("@/features/contrats"));
const RenouvellementsView = lazy(() => import("@/features/renouvellements"));
const AvenantsView = lazy(() => import("@/features/avenants"));
const ResiliationsView = lazy(() => import("@/features/resiliations"));
const SinistresView = lazy(() => import("@/features/sinistres"));
const ParticipantsView = lazy(() => import("@/features/participants"));
const PrisesEnChargeView = lazy(() => import("@/features/prises-en-charge"));
const AccordPrealableView = lazy(() => import("@/features/accord-prealable"));
const FraudeView = lazy(() => import("@/features/fraude"));
const PrestatairesView = lazy(() => import("@/features/prestataires"));
const ReglementPrestataireView = lazy(() => import("@/features/reglement-prestataire"));
const EtatTpsView = lazy(() => import("@/features/etat-tps"));
const ReglementComptableView = lazy(() => import("@/features/reglement-comptable"));
const ComptabiliteView = lazy(() => import("@/features/comptabilite"));
const CommissionsView = lazy(() => import("@/features/commissions"));
const RecouvrementView = lazy(() => import("@/features/recouvrement"));
const TresorerieView = lazy(() => import("@/features/tresorerie"));
const FondsDeRoulementView = lazy(() => import("@/features/fonds-de-roulement"));
const HonorairesView = lazy(() => import("@/features/honoraires"));
const GarantiesCatalogueView = lazy(() => import("@/features/garanties-catalogue"));
const CartesAssuranceView = lazy(() => import("@/features/cartes-assurance"));
const ActesMedicauxView = lazy(() => import("@/features/actes-medicaux"));
const LettresClesView = lazy(() => import("@/features/lettres-cles"));
const JournalOperationsView = lazy(() => import("@/features/journal-operations"));
const RapportsIaView = lazy(() => import("@/features/rapports-ia"));
const SuiviAgentsView = lazy(() => import("@/features/suivi-agents"));
const FactureProductionView = lazy(() => import("@/features/facture-production"));
const CourrierMaladieView = lazy(() => import("@/features/courrier-maladie"));
const ModelesCourrierView = lazy(() => import("@/features/modeles-courrier"));
const StatistiquesView = lazy(() => import("@/features/statistiques"));
const ParametresEntrepriseView = lazy(() => import("@/features/parametres-entreprise"));
const ReglesConsignesView = lazy(() => import("@/features/regles-consignes"));
const BanquesView = lazy(() => import("@/features/banques"));
const AgencesView = lazy(() => import("@/features/agences"));
const ImportDonneesView = lazy(() => import("@/features/import-donnees"));
const BordereauSinistresView = lazy(() => import("@/features/bordereau-sinistres"));
const BordereauProductionView = lazy(() => import("@/features/bordereau-production"));
const BordereauEncaissementView = lazy(() => import("@/features/bordereau-encaissement"));
const GedView = lazy(() => import("@/features/ged"));
const IAView = lazy(() => import("@/features/ia"));
const RapportsView = lazy(() => import("@/features/rapports"));
const AdminView = lazy(() => import("@/features/admin"));
const PortailDashboardView = lazy(() => import("@/features/portail-client/Dashboard"));
const PortailContratsView = lazy(() => import("@/features/portail-client/Contrats"));
const PortailParticipantsView = lazy(() => import("@/features/portail-client/Participants"));
const PortailDemandesView = lazy(() => import("@/features/portail-client/Demandes"));
const PortailReseauSoinsView = lazy(() => import("@/features/portail-client/ReseauSoins"));
const PortailReglesConsignesView = lazy(() => import("@/features/portail-client/ReglesConsignes"));
const PortailUtilisateursView = lazy(() => import("@/features/portail-client/Utilisateurs"));
const PortailStatistiquesView = lazy(() => import("@/features/portail-client/Statistiques"));
const DemandesClientView = lazy(() => import("@/features/demandes-client"));
const MessagerieView = lazy(() => import("@/features/messagerie/Messagerie"));
const CommunicationsView = lazy(() => import("@/features/communications"));
const ProfessionnelsSanteView = lazy(() => import("@/features/medecins"));
const MembreDashboardView = lazy(() => import("@/features/portail-membre/Dashboard"));
const MembreCarteView = lazy(() => import("@/features/portail-membre/Carte"));
const MembreGarantiesView = lazy(() => import("@/features/portail-membre/Garanties"));
const MembrePriseEnChargeView = lazy(() => import("@/features/portail-membre/PriseEnCharge"));
const MembreRemboursementView = lazy(() => import("@/features/portail-membre/Remboursement"));
const MembreReseauSoinsView = lazy(() => import("@/features/portail-membre/ReseauSoins"));
const MembreCarnetSanteView = lazy(() => import("@/features/portail-membre/CarnetSante"));
const MembreHistoriqueView = lazy(() => import("@/features/portail-membre/Historique"));
const MembreFamilleView = lazy(() => import("@/features/portail-membre/Famille"));
const MembreDelegationsView = lazy(() => import("@/features/portail-membre/Delegations"));
const PrestataireDashboardView = lazy(() => import("@/features/portail-prestataire/Dashboard"));
const PrestatairePatientsView = lazy(() => import("@/features/portail-prestataire/Patients"));
const PrestatairePrestationsView = lazy(() => import("@/features/portail-prestataire/Prestations"));
const PrestataireContactsView = lazy(() => import("@/features/portail-prestataire/Placeholder").then(m => ({ default: m.PrestataireContactsView })));
const PrestataireLogistiqueView = lazy(() => import("@/features/portail-prestataire/Placeholder").then(m => ({ default: m.PrestataireLogistiqueView })));
const PrestataireDevisView = lazy(() => import("@/features/portail-prestataire/Devis"));
const PrestataireFinanceView = lazy(() => import("@/features/portail-prestataire/Finance"));
const TraiterBonView = lazy(() => import("@/features/portail-prestataire/TraiterBon"));
const MedecinFileAttenteView = lazy(() => import("@/features/portail-medecin/FileAttente"));
const MedecinConsultationView = lazy(() => import("@/features/portail-medecin/Consultation"));
const MedecinDashboardView = lazy(() => import("@/features/portail-medecin/Dashboard"));
const MedecinDossiersPatientsView = lazy(() => import("@/features/portail-medecin/DossiersPatients"));
const MedecinHistoriquePrestationsView = lazy(() => import("@/features/portail-medecin/HistoriquePrestations"));
const SuperAdminDashboardView = lazy(() => import("@/features/super-admin/Dashboard"));
const SuperAdminSocietesView = lazy(() => import("@/features/super-admin/Societes"));
const SuperAdminUtilisateursView = lazy(() => import("@/features/super-admin/Utilisateurs"));
const SuperAdminPlansView = lazy(() => import("@/features/super-admin/Plans"));
const SuperAdminFacturationView = lazy(() => import("@/features/super-admin/Facturation"));
const SuperAdminPerformanceView = lazy(() => import("@/features/super-admin/Performance"));
const SuperAdminTarificationView = lazy(() => import("@/features/super-admin/Tarification"));
const SuperAdminModelesCarteView = lazy(() => import("@/features/super-admin/ModelesCarte"));
const EbillingView = lazy(() => import("@/features/ebilling"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const viewRegistry: Record<View, React.ComponentType<any>> = {
  dashboard: RoleDashboard,
  sante: SanteAdminConsole,
  crm: CrmView,
  clients: ClientsView,
  compagnies: CompagniesView,
  autoGestion: AutoGestionView,
  appelOffres: AppelOffresView,
  cotation: CotationView,
  contrats: ContratsView,
  renouvellements: RenouvellementsView,
  avenants: AvenantsView,
  resiliations: ResiliationsView,
  sinistres: SinistresView,
  participants: ParticipantsView,
  prisesEnCharge: PrisesEnChargeView,
  accordPrealable: AccordPrealableView,
  fraude: FraudeView,
  prestataires: PrestatairesView,
  reglementPrestataire: ReglementPrestataireView,
  etatTps: EtatTpsView,
  reglementComptable: ReglementComptableView,
  comptabilite: ComptabiliteView,
  commissions: CommissionsView,
  recouvrement: RecouvrementView,
  tresorerie: TresorerieView,
  fondsDeRoulement: FondsDeRoulementView,
  honoraires: HonorairesView,
  garantiesCatalogue: GarantiesCatalogueView,
  cartesAssurance: CartesAssuranceView,
  actesMedicaux: ActesMedicauxView,
  lettresCles: LettresClesView,
  journalOperations: JournalOperationsView,
  suiviAgents: SuiviAgentsView,
  factureProduction: FactureProductionView,
  courrierMaladie: CourrierMaladieView,
  modelesCourrier: ModelesCourrierView,
  statistiques: StatistiquesView,
  parametresEntreprise: ParametresEntrepriseView,
  reglesConsignes: ReglesConsignesView,
  banques: BanquesView,
  agences: AgencesView,
  importDonnees: ImportDonneesView,
  bordereauSinistres: BordereauSinistresView,
  bordereauProduction: BordereauProductionView,
  bordereauEncaissement: BordereauEncaissementView,
  ged: GedView,
  ia: IAView,
  rapports: RapportsView,
  admin: AdminView,
  portailDashboard: PortailDashboardView,
  portailContrats: PortailContratsView,
  portailParticipants: PortailParticipantsView,
  portailDemandes: PortailDemandesView,
  portailReseauSoins: PortailReseauSoinsView,
  portailReglesConsignes: PortailReglesConsignesView,
  portailUtilisateurs: PortailUtilisateursView,
  portailStatistiques: PortailStatistiquesView,
  demandesClient: DemandesClientView,
  professionnelsSante: ProfessionnelsSanteView,
  messagerie: MessagerieView,
  rapportsIa: RapportsIaView,
  communications: CommunicationsView,
  membreDashboard: MembreDashboardView,
  membreCarte: MembreCarteView,
  membreGaranties: MembreGarantiesView,
  membrePriseEnCharge: MembrePriseEnChargeView,
  membreRemboursement: MembreRemboursementView,
  membreReseauSoins: MembreReseauSoinsView,
  membreCarnetSante: MembreCarnetSanteView,
  membreHistorique: MembreHistoriqueView,
  membreFamille: MembreFamilleView,
  membreDelegations: MembreDelegationsView,
  prestataireDashboard: PrestataireDashboardView,
  prestatairePatients: PrestatairePatientsView,
  prestatairePrestations: PrestatairePrestationsView,
  prestataireContacts: PrestataireContactsView,
  prestataireDevis: PrestataireDevisView,
  prestataireFinance: PrestataireFinanceView,
  prestataireLogistique: PrestataireLogistiqueView,
  prestataireMedecinPrescripteur: MedecinConsultationView,
  prestataireTraiterBon: TraiterBonView,
  medecinFileAttente: MedecinFileAttenteView,
  medecinDashboard: MedecinDashboardView,
  medecinDossiersPatients: MedecinDossiersPatientsView,
  medecinHistoriquePrestations: MedecinHistoriquePrestationsView,
  superAdminDashboard: SuperAdminDashboardView,
  superAdminSocietes: SuperAdminSocietesView,
  superAdminUtilisateurs: SuperAdminUtilisateursView,
  superAdminPlans: SuperAdminPlansView,
  superAdminFacturation: SuperAdminFacturationView,
  superAdminPerformance: SuperAdminPerformanceView,
  superAdminTarification: SuperAdminTarificationView,
  superAdminModelesCarte: SuperAdminModelesCarteView,
  ebilling: EbillingView,
};
