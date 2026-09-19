import type { RoleId } from "@/auth/roles";

export interface MockUser {
  roleId: RoleId;
  nom: string;
  email: string;
  initiales: string;
}

// Matches backend/src/prestataires/prestataires.service.ts
// MOT_DE_PASSE_PORTAIL_PRESTATAIRE — mot de passe fixe pour TOUS les
// comptes portail prestataire (provisionnement en masse, 2026-09), distinct
// de DEMO_PASSWORD (voir AuthContext.tsx) utilisé par tous les autres rôles.
export const MOT_DE_PASSE_PORTAIL_PRESTATAIRE = "passe";

export const mockUsers: Record<RoleId, MockUser> = {
  super_admin: { roleId: "super_admin", nom: "Super Admin", email: "superadmin@medassur.app", initiales: "SA" },
  administrateur: { roleId: "administrateur", nom: "Aristide Bengono", email: "a.bengono@medassur.ga", initiales: "AB" },
  direction_generale: { roleId: "direction_generale", nom: "Hélène Mvondo", email: "h.mvondo@medassur.ga", initiales: "HM" },
  directeur_technique: { roleId: "directeur_technique", nom: "Serge Ondoa", email: "s.ondoa@medassur.ga", initiales: "SO" },
  gestionnaire_production: { roleId: "gestionnaire_production", nom: "Eric Kabila", email: "e.kabila@medassur.ga", initiales: "EK" },
  gestionnaire_sinistres: { roleId: "gestionnaire_sinistres", nom: "Solange Ntsame", email: "s.ntsame@medassur.ga", initiales: "SN" },
  gestionnaire_sante: { roleId: "gestionnaire_sante", nom: "Grace Etoundi", email: "g.etoundi@medassur.ga", initiales: "GE" },
  gestionnaire_entreprises: { roleId: "gestionnaire_entreprises", nom: "Julie Tchamba", email: "j.tchamba@medassur.ga", initiales: "JT" },
  comptable: { roleId: "comptable", nom: "Théodore Nguema", email: "t.nguema@medassur.ga", initiales: "TN" },
  commercial: { roleId: "commercial", nom: "Cécile Ndong", email: "c.ndong@medassur.ga", initiales: "CN" },
  agent_recouvrement: { roleId: "agent_recouvrement", nom: "Bruno Kombila", email: "b.kombila@medassur.ga", initiales: "BK" },
  courtier_partenaire: { roleId: "courtier_partenaire", nom: "Cabinet Ogooué Courtage", email: "contact@ogooue-courtage.ga", initiales: "OC" },
  compagnie_assurance: { roleId: "compagnie_assurance", nom: "OGAR", email: "partenaires@ogar.ga", initiales: "OG" },
  prestataire_sante: { roleId: "prestataire_sante", nom: "CHU Libreville", email: "facturation@chu-libreville.ga", initiales: "CL" },
  expert_sinistres: { roleId: "expert_sinistres", nom: "Cabinet Expertise Ogooué", email: "contact@expertise-ogooue.ga", initiales: "EO" },
  client_particulier: { roleId: "client_particulier", nom: "Marielle Obame", email: "marielle.obame@gmail.com", initiales: "MO" },
  // SEEG (2026-08) — voir demande utilisateur : compte de démonstration du
  // portail client avec des données réelles à tester (2 contrats, 8+
  // participants), contrairement à SOGARA qui n'a aucun contrat seedé.
  client_entreprise: { roleId: "client_entreprise", nom: "SEEG", email: "portail@seeg.ga", initiales: "SG" },
  // Portail assuré (2026-08) — voir backend/prisma/seed.ts : Paul Ondo
  // (ASS-001) a 3 ayants droit et un contrat riche en garanties/exercices.
  assure_principal: { roleId: "assure_principal", nom: "Paul Ondo", email: "paul.ondo@assure.medassur.local", initiales: "PO" },
  // Portail médecin (2026-08) — voir demande utilisateur : "il faut donc
  // créer un compte demo pour le médecin" — Dr Alice Mba, déjà liée à CHU
  // Libreville (voir backend/prisma/seed.ts).
  medecin_prescripteur: { roleId: "medecin_prescripteur", nom: "Dr Alice Mba", email: "alice.mba@medecin.medassur.local", initiales: "AM" },
};

// Comptes prestataire de démo, au-delà du tuile principale ci-dessus
// (CHU Libreville) — voir demande utilisateur : "affiche-les dans la liste
// des portails externe de l'application" (Pharmacie Nkembo/Akanda,
// Laboratoire Bio-Gabon/Owendo Santé, voir backend/prisma/seed.ts) : le
// portail prestataire a plusieurs comptes de test réels selon le profil
// (Hôpital, Pharmacie, Laboratoire), contrairement aux autres rôles
// "externe" ci-dessus qui n'en ont qu'un seul — voir LoginView.tsx.
export const mockPrestatairesSante: MockUser[] = [
  { roleId: "prestataire_sante", nom: "Pharmacie Nkembo", email: "commande@pharmacie-nkembo.ga", initiales: "PN" },
  { roleId: "prestataire_sante", nom: "Laboratoire Bio-Gabon", email: "resultats@biogabon.ga", initiales: "LB" },
  { roleId: "prestataire_sante", nom: "Pharmacie Akanda", email: "contact@pharmacie-akanda.ga", initiales: "PA" },
  { roleId: "prestataire_sante", nom: "Laboratoire Owendo Santé", email: "contact@labo-owendo.ga", initiales: "LO" },
];
