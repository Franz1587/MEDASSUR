import type { View } from "@/layout/navConfig";

import RoleDashboard from "@/features/dashboard/RoleDashboard";
import SanteAdminConsole from "@/features/sante/SanteAdminConsole";
import ClientsView from "@/features/clients";
import CompagniesView from "@/features/compagnies";
import AutoGestionView from "@/features/autogestion";
import ContratsView from "@/features/contrats";
import SinistresView from "@/features/sinistres";
import ParticipantsView from "@/features/participants";
import PrisesEnChargeView from "@/features/prises-en-charge";
import AccordPrealableView from "@/features/accord-prealable";
import FraudeView from "@/features/fraude";
import PrestatairesView from "@/features/prestataires";
import ReglementPrestataireView from "@/features/reglement-prestataire";
import EtatTpsView from "@/features/etat-tps";
import ReglementComptableView from "@/features/reglement-comptable";
import ComptabiliteView from "@/features/comptabilite";
import IAView from "@/features/ia";
import RapportsView from "@/features/rapports";
import AdminView from "@/features/admin";
import RenouvellementsView from "@/features/renouvellements";
import AvenantsView from "@/features/avenants";
import ResiliationsView from "@/features/resiliations";
import CommissionsView from "@/features/commissions";
import TresorerieView from "@/features/tresorerie";
import RecouvrementView from "@/features/recouvrement";
import CrmView from "@/features/crm";
import GedView from "@/features/ged";
import AppelOffresView from "@/features/appel-offres";
import CotationView from "@/features/cotation";
import FondsDeRoulementView from "@/features/fonds-de-roulement";
import HonorairesView from "@/features/honoraires";
import GarantiesCatalogueView from "@/features/garanties-catalogue";
import CartesAssuranceView from "@/features/cartes-assurance";
import ActesMedicauxView from "@/features/actes-medicaux";
import LettresClesView from "@/features/lettres-cles";
import JournalOperationsView from "@/features/journal-operations";
import RapportsIaView from "@/features/rapports-ia";
import SuiviAgentsView from "@/features/suivi-agents";
import FactureProductionView from "@/features/facture-production";
import CourrierMaladieView from "@/features/courrier-maladie";
import ModelesCourrierView from "@/features/modeles-courrier";
import StatistiquesView from "@/features/statistiques";
import ParametresEntrepriseView from "@/features/parametres-entreprise";
import ReglesConsignesView from "@/features/regles-consignes";
import BanquesView from "@/features/banques";
import AgencesView from "@/features/agences";
import ImportDonneesView from "@/features/import-donnees";
import BordereauSinistresView from "@/features/bordereau-sinistres";
import BordereauProductionView from "@/features/bordereau-production";
import BordereauEncaissementView from "@/features/bordereau-encaissement";
import PortailDashboardView from "@/features/portail-client/Dashboard";
import PortailContratsView from "@/features/portail-client/Contrats";
import PortailParticipantsView from "@/features/portail-client/Participants";
import PortailDemandesView from "@/features/portail-client/Demandes";
import PortailReseauSoinsView from "@/features/portail-client/ReseauSoins";
import PortailReglesConsignesView from "@/features/portail-client/ReglesConsignes";
import PortailUtilisateursView from "@/features/portail-client/Utilisateurs";
import PortailStatistiquesView from "@/features/portail-client/Statistiques";
import DemandesClientView from "@/features/demandes-client";
import MessagerieView from "@/features/messagerie/Messagerie";
import CommunicationsView from "@/features/communications";
import ProfessionnelsSanteView from "@/features/medecins";
import MembreDashboardView from "@/features/portail-membre/Dashboard";
import MembreCarteView from "@/features/portail-membre/Carte";
import MembreGarantiesView from "@/features/portail-membre/Garanties";
import MembrePriseEnChargeView from "@/features/portail-membre/PriseEnCharge";
import MembreRemboursementView from "@/features/portail-membre/Remboursement";
import MembreReseauSoinsView from "@/features/portail-membre/ReseauSoins";
import MembreCarnetSanteView from "@/features/portail-membre/CarnetSante";
import MembreHistoriqueView from "@/features/portail-membre/Historique";
import MembreFamilleView from "@/features/portail-membre/Famille";
import MembreDelegationsView from "@/features/portail-membre/Delegations";
import PrestataireDashboardView from "@/features/portail-prestataire/Dashboard";
import PrestatairePatientsView from "@/features/portail-prestataire/Patients";
import PrestatairePrestationsView from "@/features/portail-prestataire/Prestations";
import PrestataireDevisView from "@/features/portail-prestataire/Devis";
import PrestataireFinanceView from "@/features/portail-prestataire/Finance";
import {
  PrestataireContactsView, PrestataireLogistiqueView,
} from "@/features/portail-prestataire/Placeholder";
import TraiterBonView from "@/features/portail-prestataire/TraiterBon";
import MedecinFileAttenteView from "@/features/portail-medecin/FileAttente";
import MedecinConsultationView from "@/features/portail-medecin/Consultation";
import MedecinDashboardView from "@/features/portail-medecin/Dashboard";
import MedecinDossiersPatientsView from "@/features/portail-medecin/DossiersPatients";
import MedecinHistoriquePrestationsView from "@/features/portail-medecin/HistoriquePrestations";
import SuperAdminDashboardView from "@/features/super-admin/Dashboard";
import SuperAdminSocietesView from "@/features/super-admin/Societes";
import SuperAdminUtilisateursView from "@/features/super-admin/Utilisateurs";
import SuperAdminPlansView from "@/features/super-admin/Plans";
import SuperAdminFacturationView from "@/features/super-admin/Facturation";
import SuperAdminPerformanceView from "@/features/super-admin/Performance";
import SuperAdminTarificationView from "@/features/super-admin/Tarification";
import SuperAdminModelesCarteView from "@/features/super-admin/ModelesCarte";

export const viewRegistry: Record<View, React.ComponentType> = {
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
};
