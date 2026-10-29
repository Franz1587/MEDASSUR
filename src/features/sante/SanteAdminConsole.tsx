import { lazy, Suspense, useRef, useState } from "react";
import { viewLabels, type View } from "@/layout/navConfig";
import { ShellNavigationProvider } from "@/layout/ShellNavigationContext";
import { AdminShell } from "@/features/sante/admin/AdminShell";
import { ViewFallback } from "@/components/shared/ViewFallback";

const RoleDashboard = lazy(() => import("@/features/dashboard/RoleDashboard"));
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
const ParticipantsView = lazy(() => import("@/features/participants"));
const SinistresView = lazy(() => import("@/features/sinistres"));
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
const GedView = lazy(() => import("@/features/ged"));
const IAView = lazy(() => import("@/features/ia"));
const RapportsView = lazy(() => import("@/features/rapports"));
const AdminView = lazy(() => import("@/features/admin"));
const GarantiesCatalogueView = lazy(() => import("@/features/garanties-catalogue"));
const CartesAssuranceView = lazy(() => import("@/features/cartes-assurance"));
const ActesMedicauxView = lazy(() => import("@/features/actes-medicaux"));
const LettresClesView = lazy(() => import("@/features/lettres-cles"));
const JournalOperationsView = lazy(() => import("@/features/journal-operations"));
const SuiviAgentsView = lazy(() => import("@/features/suivi-agents"));
const FactureProductionView = lazy(() => import("@/features/facture-production"));
const CourrierMaladieView = lazy(() => import("@/features/courrier-maladie"));
const ModelesCourrierView = lazy(() => import("@/features/modeles-courrier"));
const StatistiquesView = lazy(() => import("@/features/statistiques"));
const ParametresEntrepriseView = lazy(() => import("@/features/parametres-entreprise"));
const ReglesConsignesView = lazy(() => import("@/features/regles-consignes"));
const BanquesView = lazy(() => import("@/features/banques"));
const AgencesView = lazy(() => import("@/features/agences"));
const BordereauSinistresView = lazy(() => import("@/features/bordereau-sinistres"));
const BordereauProductionView = lazy(() => import("@/features/bordereau-production"));
const BordereauEncaissementView = lazy(() => import("@/features/bordereau-encaissement"));
const DemandesClientView = lazy(() => import("@/features/demandes-client"));
const MessagerieView = lazy(() => import("@/features/messagerie/Messagerie"));
const CommunicationsView = lazy(() => import("@/features/communications"));
const ImportDonneesView = lazy(() => import("@/features/import-donnees"));
const ProfessionnelsSanteView = lazy(() => import("@/features/medecins"));
const EbillingView = lazy(() => import("@/features/ebilling"));

/**
 * The console renders inside the single application shell (AdminShell):
 * one full-screen console with its own zone-card sidebar, local navigation
 * state (`localView`), and breadcrumb — every entry below is a REAL,
 * API-backed page (no mock `SanteAdminXxxPage` placeholders).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consoleRegistry: Partial<Record<View, React.ComponentType<any>>> = {
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
  ebilling: EbillingView,
};

// Persistance de la vue courante (2026-10) — voir demande utilisateur :
// "lorsqu'on fait hard refresh (F5/Ctrl+F5/Ctrl+Shift+R), cela ne doit plus
// aller à la page d'accueil mais rester sur la même page". sessionStorage
// survit au hard refresh (contrairement à localStorage, elle est scopée à
// l'onglet et vidée à sa fermeture — ce qui correspond exactement à
// "rafraîchir sans perdre la page, mais réinitialiser quand on ouvre un
// nouvel onglet").
const SESSION_VIEW_KEY_ERP = "medassur-view-erp";

export default function SanteAdminConsole() {
  const [localView, setLocalViewRaw] = useState<View>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_VIEW_KEY_ERP) as View | null;
      if (stored && stored in consoleRegistry) return stored;
    } catch { /* ignore */ }
    return "dashboard";
  });
  const setLocalView = (v: View) => {
    setLocalViewRaw(v);
    try { sessionStorage.setItem(SESSION_VIEW_KEY_ERP, v); } catch { /* ignore */ }
  };

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
        <Suspense fallback={<ViewFallback />}>
          <ActivePage />
        </Suspense>
      </AdminShell>
    </ShellNavigationProvider>
  );
}
