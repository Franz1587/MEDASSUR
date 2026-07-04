import { useAuth } from "@/auth/AuthContext";
import { roleFamilies } from "@/auth/roleFamilies";
import DashboardView from "@/features/dashboard";
import ProductionDashboard from "@/features/dashboard/ProductionDashboard";
import SinistresSanteDashboard from "@/features/dashboard/SinistresSanteDashboard";
import FinanceDashboard from "@/features/dashboard/FinanceDashboard";
import CommercialDashboard from "@/features/dashboard/CommercialDashboard";

/**
 * Renders a dashboard tailored to the logged-in user's role family
 * (see src/auth/roleFamilies.ts). Falls back to the generic strategic
 * DashboardView for the "direction" family and for any role with no
 * family entry — which covers all 7 external roles, so PortalShell's
 * dashboard tab is unaffected by this router.
 */
export default function RoleDashboard() {
  const { currentRole } = useAuth();
  const family = currentRole ? roleFamilies[currentRole.id] : undefined;

  switch (family) {
    case "production":
      return <ProductionDashboard />;
    case "sinistres_sante":
      return <SinistresSanteDashboard />;
    case "finance":
      return <FinanceDashboard />;
    case "commercial":
      return <CommercialDashboard />;
    case "direction":
    default:
      return <DashboardView />;
  }
}
