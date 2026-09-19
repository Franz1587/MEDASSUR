import { useRef, useState } from "react";
import { viewLabels, type View } from "@/layout/navConfig";
import { ShellNavigationProvider } from "@/layout/ShellNavigationContext";
import { AdminShell } from "@/features/sante/admin/AdminShell";
import RoleDashboard from "@/features/dashboard/RoleDashboard";
import CrmView from "@/features/crm";
import ClientsView from "@/features/clients";
import CompagniesView from "@/features/compagnies";
import AutoGestionView from "@/features/autogestion";
import AppelOffresView from "@/features/appel-offres";
import CotationView from "@/features/cotation";
import ContratsView from "@/features/contrats";
import RenouvellementsView from "@/features/renouvellements";
import AvenantsView from "@/features/avenants";
import ResiliationsView from "@/features/resiliations";
import ParticipantsView from "@/features/participants";
import SinistresView from "@/features/sinistres";
import PrisesEnChargeView from "@/features/prises-en-charge";
import AccordPrealableView from "@/features/accord-prealable";
import FraudeView from "@/features/fraude";
import PrestatairesView from "@/features/prestataires";
import ReglementPrestataireView from "@/features/reglement-prestataire";
import EtatTpsView from "@/features/etat-tps";
import ReglementComptableView from "@/features/reglement-comptable";
import ComptabiliteView from "@/features/comptabilite";
import CommissionsView from "@/features/commissions";
import RecouvrementView from "@/features/recouvrement";
import TresorerieView from "@/features/tresorerie";
import FondsDeRoulementView from "@/features/fonds-de-roulement";
import HonorairesView from "@/features/honoraires";
import GedView from "@/features/ged";
import IAView from "@/features/ia";
import RapportsView from "@/features/rapports";
import AdminView from "@/features/admin";
import GarantiesCatalogueView from "@/features/garanties-catalogue";
import CartesAssuranceView from "@/features/cartes-assurance";
import ActesMedicauxView from "@/features/actes-medicaux";
import LettresClesView from "@/features/lettres-cles";
import JournalOperationsView from "@/features/journal-operations";
import SuiviAgentsView from "@/features/suivi-agents";
import FactureProductionView from "@/features/facture-production";
import CourrierMaladieView from "@/features/courrier-maladie";
import ModelesCourrierView from "@/features/modeles-courrier";
import StatistiquesView from "@/features/statistiques";
import ParametresEntrepriseView from "@/features/parametres-entreprise";
import ReglesConsignesView from "@/features/regles-consignes";
import BanquesView from "@/features/banques";
import AgencesView from "@/features/agences";
import BordereauSinistresView from "@/features/bordereau-sinistres";
import BordereauProductionView from "@/features/bordereau-production";
import BordereauEncaissementView from "@/features/bordereau-encaissement";
import DemandesClientView from "@/features/demandes-client";
import MessagerieView from "@/features/messagerie/Messagerie";
import CommunicationsView from "@/features/communications";
import ImportDonneesView from "@/features/import-donnees";
import ProfessionnelsSanteView from "@/features/medecins";

/**
 * The console renders inside the single application shell (AdminShell):
 * one full-screen console with its own zone-card sidebar, local navigation
 * state (`localView`), and breadcrumb — every entry below is a REAL,
 * API-backed page (no mock `SanteAdminXxxPage` placeholders).
 */
const consoleRegistry: Partial<Record<View, React.ComponentType>> = {
  dashboard: RoleDashboard,
  crm: CrmView,
  clients: ClientsView,
  compagnies: CompagniesView,
  autoGestion: AutoGestionView,
  appelOffres: AppelOffresView,
  cotation: CotationView,
  contrats: ContratsView,
  renouvellements: RenouvellementsView,
  avenants: AvenantsView,
  demandesClient: DemandesClientView,
  resiliations: ResiliationsView,
  participants: ParticipantsView,
  garantiesCatalogue: GarantiesCatalogueView,
  cartesAssurance: CartesAssuranceView,
  actesMedicaux: ActesMedicauxView,
  lettresCles: LettresClesView,
  journalOperations: JournalOperationsView,
  suiviAgents: SuiviAgentsView,
  factureProduction: FactureProductionView,
  courrierMaladie: CourrierMaladieView,
  modelesCourrier: ModelesCourrierView,
  parametresEntreprise: ParametresEntrepriseView,
  reglesConsignes: ReglesConsignesView,
  banques: BanquesView,
  agences: AgencesView,
  sinistres: SinistresView,
  prisesEnCharge: PrisesEnChargeView,
  accordPrealable: AccordPrealableView,
  fraude: FraudeView,
  prestataires: PrestatairesView,
  reglementPrestataire: ReglementPrestataireView,
  etatTps: EtatTpsView,
  bordereauSinistres: BordereauSinistresView,
  bordereauProduction: BordereauProductionView,
  bordereauEncaissement: BordereauEncaissementView,
  reglementComptable: ReglementComptableView,
  comptabilite: ComptabiliteView,
  commissions: CommissionsView,
  recouvrement: RecouvrementView,
  tresorerie: TresorerieView,
  fondsDeRoulement: FondsDeRoulementView,
  honoraires: HonorairesView,
  statistiques: StatistiquesView,
  ged: GedView,
  ia: IAView,
  rapports: RapportsView,
  admin: AdminView,
  messagerie: MessagerieView,
  communications: CommunicationsView,
  importDonnees: ImportDonneesView,
  professionnelsSante: ProfessionnelsSanteView,
};

export default function SanteAdminConsole() {
  const [localView, setLocalView] = useState<View>("dashboard");
  const [shellActionRequest, setShellActionRequest] = useState<{ view: View; label: string; scope: "top" | "nested"; nonce: number } | null>(null);
  const ActivePage = consoleRegistry[localView] ?? RoleDashboard;

  const triggerShellAction = (view: View, label: string, scope: "top" | "nested") => {
    setShellActionRequest((prev) => ({ view, label, scope, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  // Voir ShellNavigationContext.tsx (scrollToTop) — créée ici (pas dans
  // AdminShell) car le Provider, qui l'expose, enveloppe AdminShell : sa
  // valeur doit être prête avant qu'AdminShell ne rende son propre conteneur.
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <ShellNavigationProvider value={{ current: localView, setView: setLocalView, shellActionRequest, triggerShellAction, scrollToTop: () => contentRef.current?.scrollTo({ top: 0 }) }}>
      <AdminShell breadcrumb={[viewLabels[localView]]} contentRef={contentRef}>
        <ActivePage />
      </AdminShell>
    </ShellNavigationProvider>
  );
}
