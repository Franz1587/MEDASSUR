import { Users, Handshake, Building2, Stethoscope, Search, HeartPulse, ListOrdered, ShieldCheck } from "lucide-react";
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
  "member-portal": {
    path: "/portal/membre", label: "Espace Assuré", icon: HeartPulse,
    subtitle: "Votre carte, vos garanties et vos remboursements",
  },
  // Portail médecin (2026-08) — voir demande utilisateur : "le médecin doit
  // avoir ses accès différents de ceux de la clinique ou l'hôpital".
  "medecin-portal": {
    path: "/portal/medecin", label: "Espace Médecin", icon: ListOrdered,
    subtitle: "Votre file d'attente et vos consultations",
  },
  // Portail Super Admin (2026-09) — voir demande utilisateur : "le super
  // Admin est le propriétaire de l'application... il doit donc avoir son
  // écran qui lui permet de voir et de gérer l'application à 360°".
  "super-admin-portal": {
    path: "/portal/super-admin", label: "Super Admin", icon: ShieldCheck,
    subtitle: "Sociétés utilisatrices et administration de la plateforme",
  },
};

export const shellHomePath: Record<ShellId, string> = {
  erp: "/app",
  "client-portal": portalMeta["client-portal"].path,
  "partner-portal": portalMeta["partner-portal"].path,
  "company-portal": portalMeta["company-portal"].path,
  "provider-portal": portalMeta["provider-portal"].path,
  "expert-portal": portalMeta["expert-portal"].path,
  "member-portal": portalMeta["member-portal"].path,
  "medecin-portal": portalMeta["medecin-portal"].path,
  "super-admin-portal": portalMeta["super-admin-portal"].path,
};
