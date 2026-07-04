import {
  LayoutDashboard, Users, Building2, FileText, Target, ScanLine, RefreshCw, Edit,
  XCircle, Shield, Stethoscope, Activity, Truck, AlertTriangle, BookOpen, DollarSign,
  CreditCard, Wallet, Archive, Brain, BarChart3, Settings, FileSearch, Calculator,
} from "lucide-react";

export type View =
  | "dashboard" | "crm" | "clients" | "compagnies" | "devis"
  | "comparateur" | "contrats" | "renouvellements" | "avenants"
  | "resiliations" | "sinistres" | "sante" | "iard" | "vie"
  | "flotte" | "comptabilite" | "commissions" | "recouvrement"
  | "tresorerie" | "ged" | "ia" | "rapports" | "admin"
  | "appelOffres" | "cotation"
  | "fondsDeRoulement" | "honoraires";

export interface NavItem {
  id: View;
  label: string;
  icon: React.ElementType;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  { label: "Accueil", items: [{ id: "dashboard", label: "Tableau de Bord", icon: LayoutDashboard }] },
  {
    label: "Commercial",
    items: [
      { id: "crm", label: "CRM & Prospection", icon: Target },
      { id: "clients", label: "Clients", icon: Users },
      { id: "compagnies", label: "Compagnies", icon: Building2 },
      { id: "devis", label: "Devis", icon: FileText },
      { id: "appelOffres", label: "Appels d'Offres", icon: FileSearch },
      { id: "cotation", label: "Cotation", icon: Calculator },
      { id: "comparateur", label: "Comparateur IA", icon: ScanLine },
    ],
  },
  {
    label: "Production",
    items: [
      { id: "contrats", label: "Contrats", icon: FileText },
      { id: "renouvellements", label: "Renouvellements", icon: RefreshCw },
      { id: "avenants", label: "Avenants", icon: Edit },
      { id: "resiliations", label: "Résiliations", icon: XCircle },
    ],
  },
  {
    label: "Branches",
    items: [
      { id: "iard", label: "IARD", icon: Shield },
      { id: "sante", label: "Assurance Santé", icon: Stethoscope },
      { id: "vie", label: "Vie & Prévoyance", icon: Activity },
      { id: "flotte", label: "Flottes Auto", icon: Truck },
    ],
  },
  { label: "Sinistres", items: [{ id: "sinistres", label: "Gestion Sinistres", icon: AlertTriangle }] },
  {
    label: "Finance",
    items: [
      { id: "comptabilite", label: "Comptabilité", icon: BookOpen },
      { id: "commissions", label: "Commissions", icon: DollarSign },
      { id: "recouvrement", label: "Recouvrement", icon: CreditCard },
      { id: "tresorerie", label: "Trésorerie", icon: Wallet },
      { id: "fondsDeRoulement", label: "Fonds de Roulement", icon: Wallet },
      { id: "honoraires", label: "Honoraires de Gestion", icon: DollarSign },
    ],
  },
  {
    label: "Outils",
    items: [
      { id: "ged", label: "GED & Documents", icon: Archive },
      { id: "ia", label: "Assistant IA", icon: Brain },
      { id: "rapports", label: "Reporting & KPIs", icon: BarChart3 },
    ],
  },
  { label: "Système", items: [{ id: "admin", label: "Administration", icon: Settings }] },
];

export const allViews: View[] = navGroups.flatMap((g) => g.items.map((i) => i.id));

export const moduleIcons: Record<View, React.ElementType> = Object.fromEntries(
  navGroups.flatMap((g) => g.items.map((i) => [i.id, i.icon])),
) as Record<View, React.ElementType>;

export const viewLabels: Record<View, string> = {
  dashboard: "Tableau de Bord", crm: "CRM & Prospection", clients: "Gestion Clients",
  compagnies: "Compagnies", devis: "Devis", comparateur: "Comparateur IA",
  contrats: "Production — Contrats", renouvellements: "Renouvellements",
  avenants: "Avenants", resiliations: "Résiliations", sinistres: "Gestion Sinistres",
  sante: "Assurance Santé", iard: "IARD", vie: "Vie & Prévoyance",
  flotte: "Flottes Auto", comptabilite: "Comptabilité SYSCOHADA",
  commissions: "Commissions", recouvrement: "Recouvrement",
  tresorerie: "Trésorerie", ged: "GED & Documents",
  ia: "Assistant IA", rapports: "Reporting & KPIs", admin: "Administration",
  appelOffres: "Appels d'Offres", cotation: "Cotation",
  fondsDeRoulement: "Fonds de Roulement", honoraires: "Honoraires de Gestion",
};
