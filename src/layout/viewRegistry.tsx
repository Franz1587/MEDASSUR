import type { View } from "@/layout/navConfig";

import RoleDashboard from "@/features/dashboard/RoleDashboard";
import ClientsView from "@/features/clients";
import CompagniesView from "@/features/compagnies";
import ContratsView from "@/features/contrats";
import ComparateurView from "@/features/comparateur";
import SinistresView from "@/features/sinistres";
import SanteView from "@/features/sante";
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
import DevisView from "@/features/devis";
import IardView from "@/features/iard";
import VieView from "@/features/vie";
import FlotteView from "@/features/flotte";
import CrmView from "@/features/crm";
import GedView from "@/features/ged";
import AppelOffresView from "@/features/appel-offres";
import CotationView from "@/features/cotation";
import PrestatairesView from "@/features/prestataires";
import AccordPrealableView from "@/features/accord-prealable";
import FondsDeRoulementView from "@/features/fonds-de-roulement";
import HonorairesView from "@/features/honoraires";
import FraudeView from "@/features/fraude";

export const viewRegistry: Record<View, React.ComponentType> = {
  dashboard: RoleDashboard,
  crm: CrmView,
  clients: ClientsView,
  compagnies: CompagniesView,
  devis: DevisView,
  appelOffres: AppelOffresView,
  cotation: CotationView,
  comparateur: ComparateurView,
  contrats: ContratsView,
  renouvellements: RenouvellementsView,
  avenants: AvenantsView,
  resiliations: ResiliationsView,
  sinistres: SinistresView,
  sante: SanteView,
  iard: IardView,
  vie: VieView,
  flotte: FlotteView,
  prestataires: PrestatairesView,
  accordPrealable: AccordPrealableView,
  fraude: FraudeView,
  comptabilite: ComptabiliteView,
  commissions: CommissionsView,
  recouvrement: RecouvrementView,
  tresorerie: TresorerieView,
  fondsDeRoulement: FondsDeRoulementView,
  honoraires: HonorairesView,
  ged: GedView,
  ia: IAView,
  rapports: RapportsView,
  admin: AdminView,
};
