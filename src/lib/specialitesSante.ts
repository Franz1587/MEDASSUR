// Spécialités médicales, paramédicales et autres secteurs liés à la santé —
// liste de suggestions pour le champ "Spécialité" d'un Prestataire (voir
// PrestataireForm.tsx). Le champ reste un texte libre côté backend
// (Prestataire.specialite, schema.prisma) : cette liste ne bloque pas la
// saisie, elle la guide — voir l'option "Autre" du formulaire.
export const SPECIALITES_SANTE: string[] = [
  // ── Médecine générale ──────────────────────────────────────────────
  "Médecine générale",

  // ── Spécialités médicales ────────────────────────────────────────────
  "Allergologie",
  "Anesthésie-Réanimation",
  "Cardiologie",
  "Dermatologie",
  "Endocrinologie-Diabétologie",
  "Gastro-entérologie",
  "Gériatrie",
  "Gynécologie-Obstétrique",
  "Hématologie",
  "Infectiologie",
  "Médecine du travail",
  "Médecine interne",
  "Médecine physique et réadaptation",
  "Néphrologie",
  "Neurologie",
  "Oncologie",
  "Ophtalmologie",
  "ORL (Oto-rhino-laryngologie)",
  "Pédiatrie",
  "Pneumologie",
  "Psychiatrie",
  "Rhumatologie",
  "Urologie",

  // ── Spécialités chirurgicales ─────────────────────────────────────
  "Chirurgie générale",
  "Chirurgie cardiovasculaire",
  "Chirurgie gynécologique",
  "Chirurgie maxillo-faciale",
  "Chirurgie orthopédique et traumatologique",
  "Chirurgie pédiatrique",
  "Chirurgie plastique et esthétique",
  "Chirurgie urologique",
  "Chirurgie viscérale et digestive",
  "Neurochirurgie",

  // ── Dentaire ──────────────────────────────────────────────────────
  "Chirurgie dentaire / Odontologie",
  "Orthodontie",
  "Parodontologie",

  // ── Paramédical ───────────────────────────────────────────────────
  "Kinésithérapie",
  "Sage-femme / Obstétrique",
  "Soins infirmiers",
  "Orthophonie",
  "Ergothérapie",
  "Diététique et Nutrition",
  "Podologie",
  "Psychologie",
  "Opticien-Lunetier",
  "Audioprothèse",

  // ── Plateau technique / diagnostic ────────────────────────────────
  "Radiologie et Imagerie médicale",
  "Analyses de biologie médicale",
  "Anatomo-cyto-pathologie",

  // ── Autres secteurs liés à la santé ───────────────────────────────
  "Pharmacie",
  "Dialyse",
  "Maternité",
  "Médecine esthétique",
  "Santé mentale / Addictologie",
];
