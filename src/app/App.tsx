import { useState } from "react";
import {
  Target, FileText, RefreshCw, Edit, XCircle, Shield, Activity, Truck,
  DollarSign, CreditCard, Wallet, Archive,
} from "lucide-react";
import { Sidebar } from "@/layout/Sidebar";
import { TopBar } from "@/layout/TopBar";
import type { View } from "@/layout/navConfig";
import { PlaceholderView } from "@/components/shared/PlaceholderView";

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

const viewRegistry: Record<View, React.ComponentType> = {
  dashboard: DashboardView,
  clients: ClientsView,
  compagnies: CompagniesView,
  contrats: ContratsView,
  comparateur: ComparateurView,
  sinistres: SinistresView,
  sante: SanteView,
  comptabilite: ComptabiliteView,
  ia: IAView,
  rapports: RapportsView,
  admin: AdminView,
  crm: () => <PlaceholderView title="CRM & Prospection" icon={Target} desc="Pipeline commercial, scoring prospects, relances automatiques et suivi des opportunités en temps réel." />,
  devis: () => <PlaceholderView title="Module Devis" icon={FileText} desc="Création de devis multi-compagnies, simulation tarifaire et envoi électronique sécurisé." />,
  renouvellements: () => <PlaceholderView title="Renouvellements" icon={RefreshCw} desc="Gestion proactive des renouvellements avec alertes automatiques et suivi du taux de fidélisation." />,
  avenants: () => <PlaceholderView title="Avenants" icon={Edit} desc="Modification des contrats en vigueur, traçabilité des avenants et génération automatique des documents." />,
  resiliations: () => <PlaceholderView title="Résiliations" icon={XCircle} desc="Traitement des demandes de résiliation, calcul des ristournes et archivage CIMA." />,
  iard: () => <PlaceholderView title="IARD — Incendie Accidents Risques Divers" icon={Shield} desc="Gestion des polices IARD: habitation, RC, multirisques entreprises, risques industriels et agricoles." />,
  vie: () => <PlaceholderView title="Vie & Prévoyance" icon={Activity} desc="Contrats vie entière, épargne retraite, prévoyance collective et décès invalidité pour entreprises." />,
  flotte: () => <PlaceholderView title="Flottes Automobiles" icon={Truck} desc="Gestion des flottes de véhicules, suivi individuel par immatriculation, sinistres et renouvellements groupés." />,
  commissions: () => <PlaceholderView title="Commissions" icon={DollarSign} desc="Suivi des commissions par compagnie et commercial, rapprochement automatique et états de compte." />,
  recouvrement: () => <PlaceholderView title="Recouvrement" icon={CreditCard} desc="Gestion des impayés, relances automatisées multi-canaux, échéanciers et intégration Mobile Money." />,
  tresorerie: () => <PlaceholderView title="Trésorerie" icon={Wallet} desc="Suivi des flux, rapprochement bancaire automatique, prévisions et intégration API bancaires CIMA." />,
  ged: () => <PlaceholderView title="GED & Documents" icon={Archive} desc="Gestion électronique des documents avec OCR, signature électronique qualifiée et archivage légal." />,
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
