import { Users, Handshake, Building2, Stethoscope, Search } from "lucide-react";
import type { ShellId } from "@/auth/roles";

export type PortalShellId = Exclude<ShellId, "erp">;

export interface PortalMeta {
  path: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
}

export const portalMeta: Record<PortalShellId, PortalMeta> = {
  "client-portal": {
    path: "/portal/client", label: "Espace Client", icon: Users,
    subtitle: "Vos contrats, sinistres et attestations",
  },
  "partner-portal": {
    path: "/portal/partner", label: "Espace Courtier Partenaire", icon: Handshake,
    subtitle: "Vos clients référés, contrats et commissions",
  },
  "company-portal": {
    path: "/portal/company", label: "Portail Compagnie", icon: Building2,
    subtitle: "Vos produits, propositions reçues et affaires en cours",
  },
  "provider-portal": {
    path: "/portal/provider", label: "Portail Prestataire", icon: Stethoscope,
    subtitle: "Prises en charge, factures et évaluations",
  },
  "expert-portal": {
    path: "/portal/expert", label: "Portail Expert", icon: Search,
    subtitle: "Dossiers d'expertise qui vous sont assignés",
  },
};

export const shellHomePath: Record<ShellId, string> = {
  erp: "/app",
  "client-portal": portalMeta["client-portal"].path,
  "partner-portal": portalMeta["partner-portal"].path,
  "company-portal": portalMeta["company-portal"].path,
  "provider-portal": portalMeta["provider-portal"].path,
  "expert-portal": portalMeta["expert-portal"].path,
};
