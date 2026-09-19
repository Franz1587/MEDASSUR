import type { mockContrats } from "@/data/mock/contrats.mock";

// Assistance liée (2026-08) — ajouté par intersection plutôt que dans le
// mock (voir contratMaladieLieId dans schema.prisma) : un contrat
// Assistance lié partage exactement la population de son contrat Maladie.
export type Contrat = (typeof mockContrats)[number] & {
  clientId: string;
  contratMaladieLieId?: string | null;
  // Numéro de police (2026-08) — référence propre à la compagnie, distincte
  // de l'id technique CTR-... (voir schema.prisma Contrat.numeroPolice).
  numeroPolice?: string | null;
  // Déclinaison structure publique/privée du résumé global (2026-08) —
  // ajoutée par intersection pour la même raison que contratMaladieLieId
  // ci-dessus. Voir schema.prisma pour l'usage (carte d'assurance + calcul
  // PriseEnCharge).
  tauxAmbulatoirePublique?: string | null;
  tauxAmbulatoirePrivee?: string | null;
  tauxHospitalisationPublique?: string | null;
  tauxHospitalisationPrivee?: string | null;
  // Taux ayants droit distincts (2026-08) — VRAIMENT en option : vides par
  // défaut, un CJ/EF suit alors exactement le taux de l'assuré principal
  // ci-dessus (voir demande utilisateur, backend schema.prisma Contrat).
  tauxAmbulatoirePubliqueAyantDroit?: string | null;
  tauxAmbulatoirePriveeAyantDroit?: string | null;
  tauxHospitalisationPubliqueAyantDroit?: string | null;
  tauxHospitalisationPriveeAyantDroit?: string | null;
  // Libellé produit (2026-08) — voir demande utilisateur : "Bordereau de
  // Production" (colonne "Produit"), distinct de `branche`. Facultatif ;
  // si vide, affiché comme "PEC {client}" côté document (jamais persisté).
  produit?: string | null;
  // Dérogation de saisie post-résiliation (2026-09) — voir demande
  // utilisateur : "il faut donc que le contrat ait un bouton 'Permettre la
  // saisie des prestations et des prises en charge après la date de
  // résiliation ou fermeture des droits'." true = la saisie de
  // prestations/prises en charge datées après dateFin reste autorisée sur
  // ce contrat Résilié malgré le blocage par défaut (voir
  // SanteService.verifierSaisieAutorisee côté backend).
  saisieApresResiliationAutorisee?: boolean;
};
