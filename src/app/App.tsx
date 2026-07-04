import { useState } from "react";
import { Sidebar } from "@/layout/Sidebar";
import { TopBar } from "@/layout/TopBar";
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

const viewRegistry: Record<View, React.ComponentType> = {
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

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const ActiveView = viewRegistry[view] ?? DashboardView;

  return (
    <div className="flex overflow-hidden" style={{ height: "100vh", fontFamily: "'Outfit', sans-serif" }}>
      <Sidebar current={view} onNavigate={setView} collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar current={view} />
        <main className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(201,162,74,0.15) transparent" }}>
          <ActiveView />
        </main>
      </div>
    </div>
  );
}
