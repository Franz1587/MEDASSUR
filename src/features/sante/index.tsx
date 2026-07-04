import { Stethoscope, LayoutDashboard, Users, AlertTriangle, Building2, FileStack, Archive } from "lucide-react";
import { BranchWorkspace, type BranchWorkspaceSection } from "@/components/shared/BranchWorkspace";
import DashboardSection from "@/features/sante/sections/DashboardSection";
import ProductionSection from "@/features/sante/sections/ProductionSection";
import SinistresControleSection from "@/features/sante/sections/SinistresControleSection";
import ReseauSoinsSection from "@/features/sante/sections/ReseauSoinsSection";
import ReglementSection from "@/features/sante/sections/ReglementSection";
import ArchivesSection from "@/features/sante/sections/ArchivesSection";

const sections: BranchWorkspaceSection[] = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, component: DashboardSection },
  { id: "production", label: "Production", icon: Users, component: ProductionSection },
  { id: "sinistres", label: "Sinistres & Contrôle", icon: AlertTriangle, component: SinistresControleSection },
  { id: "reseau", label: "Réseau de Soins", icon: Building2, component: ReseauSoinsSection },
  { id: "reglement", label: "Règlement Prestataires", icon: FileStack, component: ReglementSection },
  { id: "archives", label: "Archives", icon: Archive, component: ArchivesSection },
];

export default function SanteView() {
  return (
    <BranchWorkspace
      title="Assurance Santé"
      subtitle="Branche autonome — production, sinistres santé, réseau de soins, règlement et archivage"
      icon={Stethoscope}
      sections={sections}
    />
  );
}
