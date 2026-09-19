import { viewIcons, type View } from "@/layout/navConfig";

export interface AdminSubItem {
  label: string;
  children?: AdminSubItem[];
}

export interface AdminNavItem {
  id: View;
  label: string;
  icon: React.ElementType;
  children?: AdminSubItem[];
}

/**
 * Flat id/label/icon reference for every real `View` reachable from the
 * console — used for the (rarely shown) raw sidebar list and for
 * breadcrumb lookups. No `children` sub-tabs: each real page already
 * carries its own internal filters/actions, so a second row of tabs here
 * would just sit inert.
 */
export const santeAdminNavTree: AdminNavItem[] = [
  { id: "dashboard", label: "Accueil", icon: viewIcons.dashboard },
  { id: "crm", label: "Prospection", icon: viewIcons.crm },
  { id: "communications", label: "Communications", icon: viewIcons.communications },
  { id: "clients", label: "Souscripteurs", icon: viewIcons.clients },
  { id: "compagnies", label: "Compagnies", icon: viewIcons.compagnies },
  { id: "autoGestion", label: "Auto-Gestion", icon: viewIcons.autoGestion },
  { id: "appelOffres", label: "Appels d'Offres", icon: viewIcons.appelOffres },
  { id: "cotation", label: "Cotation", icon: viewIcons.cotation },
  { id: "contrats", label: "Contrats", icon: viewIcons.contrats },
  { id: "renouvellements", label: "Renouvellements", icon: viewIcons.renouvellements },
  { id: "avenants", label: "Quittances et Avenants", icon: viewIcons.avenants },
  { id: "demandesClient", label: "Demandes client", icon: viewIcons.demandesClient },
  { id: "resiliations", label: "Résiliations", icon: viewIcons.resiliations },
  { id: "participants", label: "Participants", icon: viewIcons.participants },
  { id: "factureProduction", label: "Facture Production", icon: viewIcons.factureProduction },
  { id: "garantiesCatalogue", label: "Catalogue de garanties", icon: viewIcons.garantiesCatalogue },
  { id: "cartesAssurance", label: "Cartes d'assurance", icon: viewIcons.cartesAssurance },
  { id: "prisesEnCharge", label: "Factures", icon: viewIcons.prisesEnCharge },
  { id: "accordPrealable", label: "Prise en charge", icon: viewIcons.accordPrealable },
  { id: "actesMedicaux", label: "Catalogue des actes médicaux", icon: viewIcons.actesMedicaux },
  { id: "lettresCles", label: "Lettres clés (nomenclature)", icon: viewIcons.lettresCles },
  { id: "courrierMaladie", label: "Courrier Maladie", icon: viewIcons.courrierMaladie },
  { id: "modelesCourrier", label: "Modèles de courrier", icon: viewIcons.modelesCourrier },
  { id: "fraude", label: "Contrôle fraude", icon: viewIcons.fraude },
  { id: "prestataires", label: "Prestataires", icon: viewIcons.prestataires },
  { id: "reglementPrestataire", label: "Règlement", icon: viewIcons.reglementPrestataire },
  { id: "reglementComptable", label: "Règlement comptable", icon: viewIcons.reglementComptable },
  { id: "etatTps", label: "État TPS", icon: viewIcons.etatTps },
  { id: "bordereauSinistres", label: "Bordereau Sinistres", icon: viewIcons.bordereauSinistres },
  { id: "bordereauProduction", label: "Bordereau Production", icon: viewIcons.bordereauProduction },
  { id: "bordereauEncaissement", label: "Bordereau Encaissement", icon: viewIcons.bordereauEncaissement },
  { id: "comptabilite", label: "Comptabilité", icon: viewIcons.comptabilite },
  { id: "commissions", label: "Commissions", icon: viewIcons.commissions },
  { id: "recouvrement", label: "Recouvrement", icon: viewIcons.recouvrement },
  { id: "tresorerie", label: "Trésorerie", icon: viewIcons.tresorerie },
  { id: "fondsDeRoulement", label: "Fonds de Roulement", icon: viewIcons.fondsDeRoulement },
  { id: "honoraires", label: "Honoraires de Gestion", icon: viewIcons.honoraires },
  { id: "statistiques", label: "Statistiques", icon: viewIcons.statistiques },
  { id: "ged", label: "GED & Documents", icon: viewIcons.ged },
  { id: "ia", label: "Assistant IA", icon: viewIcons.ia },
  { id: "rapports", label: "Reporting & KPIs", icon: viewIcons.rapports },
  { id: "journalOperations", label: "Journal des opérations", icon: viewIcons.journalOperations },
  { id: "suiviAgents", label: "Suivi de production par agent", icon: viewIcons.suiviAgents },
  { id: "admin", label: "Administration", icon: viewIcons.admin },
  { id: "parametresEntreprise", label: "Paramètres de l'entreprise", icon: viewIcons.parametresEntreprise },
  { id: "reglesConsignes", label: "Procédures", icon: viewIcons.reglesConsignes },
  { id: "banques", label: "Banques", icon: viewIcons.banques },
  { id: "agences", label: "Agences", icon: viewIcons.agences },
];
