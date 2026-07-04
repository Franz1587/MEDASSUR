import type { View } from "@/layout/navConfig";

import DashboardView from "@/features/dashboard";
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

export const viewRegistry: Record<View, React.ComponentType> = {
  dashboard: DashboardView,
  crm: CrmView,
  clients: ClientsView,
  compagnies: CompagniesView,
  devis: DevisView,
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
  comptabilite: ComptabiliteView,
  commissions: CommissionsView,
  recouvrement: RecouvrementView,
  tresorerie: TresorerieView,
  ged: GedView,
  ia: IAView,
  rapports: RapportsView,
  admin: AdminView,
};
