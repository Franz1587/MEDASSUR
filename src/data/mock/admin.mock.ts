export const mockUsers = [
  { nom: "Aristide Bengono", role: "Administrateur", email: "a.bengono@courteva.cm", statut: "Actif", login: "Aujourd'hui 08:42" },
  { nom: "Nadège Fotso", role: "Directeur Commercial", email: "n.fotso@courteva.cm", statut: "Actif", login: "Aujourd'hui 09:15" },
  { nom: "Eric Kabila", role: "Gest. Production", email: "e.kabila@courteva.cm", statut: "Actif", login: "Hier 17:30" },
  { nom: "Solange Abiodun", role: "Gest. Sinistres", email: "s.abiodun@courteva.cm", statut: "Actif", login: "Aujourd'hui 07:55" },
  { nom: "Théodore Nguema", role: "Comptable", email: "t.nguema@courteva.cm", statut: "Inactif", login: "Il y a 3 jours" },
  { nom: "Cécile Koné", role: "Commercial", email: "c.kone@courteva.cm", statut: "Actif", login: "Aujourd'hui 10:02" },
];

export const mockRoles = [
  { nom: "Administrateur", desc: "Accès complet système", n: 1 },
  { nom: "Direction", desc: "Lecture totale + approbations", n: 2 },
  { nom: "Gest. Production", desc: "Contrats, Devis, Clients", n: 4 },
  { nom: "Gest. Sinistres", desc: "Sinistres, Expertises, Recours", n: 3 },
  { nom: "Comptable", desc: "Comptabilité, Trésorerie", n: 2 },
  { nom: "Commercial", desc: "CRM, Prospects, Devis", n: 6 },
];
