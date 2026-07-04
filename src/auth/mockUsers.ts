import type { RoleId } from "@/auth/roles";

export interface MockUser {
  roleId: RoleId;
  nom: string;
  email: string;
  initiales: string;
}

export const mockUsers: Record<RoleId, MockUser> = {
  administrateur: { roleId: "administrateur", nom: "Aristide Bengono", email: "a.bengono@courteva.cm", initiales: "AB" },
  direction_generale: { roleId: "direction_generale", nom: "Hélène Mvondo", email: "h.mvondo@courteva.cm", initiales: "HM" },
  directeur_technique: { roleId: "directeur_technique", nom: "Serge Ondoa", email: "s.ondoa@courteva.cm", initiales: "SO" },
  gestionnaire_production: { roleId: "gestionnaire_production", nom: "Eric Kabila", email: "e.kabila@courteva.cm", initiales: "EK" },
  gestionnaire_sinistres: { roleId: "gestionnaire_sinistres", nom: "Solange Abiodun", email: "s.abiodun@courteva.cm", initiales: "SA" },
  gestionnaire_sante: { roleId: "gestionnaire_sante", nom: "Grace Etoundi", email: "g.etoundi@courteva.cm", initiales: "GE" },
  gestionnaire_vie: { roleId: "gestionnaire_vie", nom: "Michel Ngoy", email: "m.ngoy@courteva.cm", initiales: "MN" },
  gestionnaire_flotte: { roleId: "gestionnaire_flotte", nom: "David Amougou", email: "d.amougou@courteva.cm", initiales: "DA" },
  gestionnaire_entreprises: { roleId: "gestionnaire_entreprises", nom: "Julie Tchamba", email: "j.tchamba@courteva.cm", initiales: "JT" },
  comptable: { roleId: "comptable", nom: "Théodore Nguema", email: "t.nguema@courteva.cm", initiales: "TN" },
  commercial: { roleId: "commercial", nom: "Cécile Koné", email: "c.kone@courteva.cm", initiales: "CK" },
  agent_recouvrement: { roleId: "agent_recouvrement", nom: "Bruno Kamga", email: "b.kamga@courteva.cm", initiales: "BK" },
  courtier_partenaire: { roleId: "courtier_partenaire", nom: "Cabinet Alpha Courtage", email: "contact@alpha-courtage.ci", initiales: "AC" },
  compagnie_assurance: { roleId: "compagnie_assurance", nom: "ACTIVA Assurances", email: "partenaires@activa-assurances.cm", initiales: "AA" },
  prestataire_sante: { roleId: "prestataire_sante", nom: "Hôpital Général Yaoundé", email: "facturation@hgy.cm", initiales: "HG" },
  expert_auto: { roleId: "expert_auto", nom: "Cabinet Expertise Motors", email: "contact@expertise-motors.ci", initiales: "EM" },
  expert_sinistres: { roleId: "expert_sinistres", nom: "Cabinet Alpha Expertise", email: "contact@alpha-expertise.cm", initiales: "AE" },
  client_particulier: { roleId: "client_particulier", nom: "Marie-Claire Diallo", email: "mc.diallo@gmail.com", initiales: "MD" },
  client_entreprise: { roleId: "client_entreprise", nom: "SABC SA", email: "assurances@sabc.cm", initiales: "SS" },
};
