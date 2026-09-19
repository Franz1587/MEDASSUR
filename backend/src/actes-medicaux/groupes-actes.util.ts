// Groupes d'actes (2026-08) — voir demande utilisateur : "il faut par
// contre faire remonter les familles des actes [en boutons 'Nouvelle
// prestation']. Exemple: Consultation, Analyse, Hospitalisation,
// Imagerie…" et "définir... les actes qui doivent remonter vers l'écran
// d'un prestataire, c'est ainsi qu'une pharmacie, un laboratoire n'aura
// pas besoin de consultation." Regroupe les 27 familles brutes du
// catalogue (voir seed-actes-medicaux.ts, ActeMedical.famille) en une
// dizaine de groupes exploitables à la fois comme boutons "Nouvelle
// prestation" ET comme granularité de configuration
// Prestataire.categoriesActesVisibles — DOIT rester synchronisé avec la
// copie frontend (voir src/features/portail-prestataire/prestationTypes.ts,
// même duplication assumée qu'ailleurs dans l'app).
export interface GroupeActe {
  cle: string;
  label: string;
  familles: string[];
  // Type de prestation par défaut pour le calcul assurance (voir
  // SanteService.calculerPartAssuranceLigne) quand ce groupe est choisi en
  // "Nouvelle prestation" — reste modifiable ensuite dans le formulaire.
  typePrestationDefaut: string;
}

// Consultation, généraliste ou spécialisée (2026-08) — voir demande
// utilisateur : "qu'elle soit généralisées ou spécialisées, il faut
// regrouper les consultations simplement dans la rubrique 'Consultation'"
// — un seul groupe, plus de bouton "Consultations spécialisées" séparé.
export const GROUPES_ACTES: GroupeActe[] = [
  {
    cle: "Consultation", label: "Consultation",
    familles: ["CONSULTATIONS", "ACTES CARDIOLOGIE", "ACTES D'OPHTALMOLOGIE", "ACTES DE L'UROLOGUE", "ACTES DU DERMATOLOGUE", "ACTES DU GASTROLOGUE", "ACTES DU NEUROLOGUE", "ACTES DU RHUMATOLOGUE", "ACTES GYNÉCO", "ACTES ORL"],
    typePrestationDefaut: "Ambulatoire",
  },
  { cle: "Analyse", label: "Analyse", familles: ["EXAMENS LABORATOIRE"], typePrestationDefaut: "Ambulatoire" },
  {
    cle: "Imagerie", label: "Imagerie",
    familles: ["RADIOLOGIE", "RADIOLOGIE ABDOMEN", "RADIOLOGIE MEMBRES INFÉRIEURS", "RADIOLOGIE MEMBRES SUPÉRIEURS", "RADIOLOGIE RACHIS", "RADIOLOGIE TRONC", "IRM", "SCANNER / TDM", "ÉCHOGRAPHIE"],
    typePrestationDefaut: "Ambulatoire",
  },
  {
    cle: "Hospitalisation", label: "Hospitalisation & Chirurgie",
    familles: ["ACTES CHIRURGICAUX", "PLÂTRE, ATTELLE ET POINT DE SUTURE", "DIALYSE & RADIOTHÉRAPIE"],
    typePrestationDefaut: "Hospitalisation",
  },
  { cle: "Dentaire", label: "Dentaire", familles: ["SOINS & PROTHÈSES DENTAIRES", "SOINS DENTAIRES & CONSERVATEURS"], typePrestationDefaut: "Dentisterie" },
  { cle: "Kinesitherapie", label: "Kinésithérapie", familles: ["KINÉSITHÉRAPIE & CURES THERMALES"], typePrestationDefaut: "Kinésithérapie & Cure thermale" },
  // "Actes de Spécialités" détaché d'Hospitalisation (2026-08) — voir
  // demande utilisateur : "il faut détacher pharmacie et soins et
  // renommer soins par 'Actes de Spécialités'" — "PETITE CHIRURGIE &
  // SOINS INFIRMIERS" n'est pas une hospitalisation à proprement parler.
  // "DIVERS" y est ajouté (2026-08) — voir demande utilisateur : "Pharmacie
  // ne doit concerner que les médicaments pharmaceutiques. Les données
  // actuellement dans la rubrique Pharmacie doivent basculer dans Actes de
  // Spécialités" (injection, pansement, marche 6 min, chambre/hébergement
  // — voir seed-actes-medicaux.ts).
  { cle: "ActesSpecialites", label: "Actes de Spécialités", familles: ["PETITE CHIRURGIE & SOINS INFIRMIERS", "DIVERS"], typePrestationDefaut: "Ambulatoire" },
  // "Pharmacie" — uniquement les médicaments (2026-08) — voir demande
  // utilisateur ci-dessus. La clé reste "Autre" (déjà stockée dans
  // Prestataire.categoriesActesVisibles pour les pharmacies, voir
  // seed.ts) — seule la famille rattachée change, vers la nouvelle
  // famille dédiée "PHARMACIE" (3762 produits, voir seed-actes-medicaux.ts).
  // typePrestationDefaut Ambulatoire, pas "Autre" (2026-08) — voir demande
  // utilisateur : "il y a également le principe du taux ambulatoire et du
  // taux hospitalisation. Si on coche la case ambulatoire c'est le taux en
  // ambulatoire qui s'applique... et si on coche la case hospitalisation,
  // ce sera le taux en hospitalisation" — un médicament suit donc le calcul
  // au pourcentage (Ambulatoire/Hospitalisation, TOUJOURS au taux Privé —
  // voir SanteService.calculerPartAssuranceLigne), jamais le plafond de
  // rubrique "Autre" (qui n'a d'ailleurs pas vocation à couvrir la
  // pharmacie). Le portail restreint le choix à ces deux valeurs pour ce
  // groupe (voir Prestations.tsx), la valeur ici n'est que le défaut.
  { cle: "Autre", label: "Pharmacie", familles: ["PHARMACIE"], typePrestationDefaut: "Ambulatoire" },
];

const FAMILLE_VERS_GROUPE = new Map<string, string>(GROUPES_ACTES.flatMap((g) => g.familles.map((f) => [f, g.cle] as const)));

export function groupeDeFamille(famille: string | null | undefined): string | undefined {
  return famille ? FAMILLE_VERS_GROUPE.get(famille) : undefined;
}

// Libellé du groupe (2026-08) — voir demande utilisateur : "'Consultation/
// Divers' ça ne veut rien dire. Chaque acte est lié à une famille, c'est
// donc la famille qui doit remonter" (écran Historique de soins côté
// Espace Assuré) — plus précis que Garantie.categorie (8 rubriques
// contractuelles larges), qui reste néanmoins la bonne granularité pour le
// suivi de plafond (voir DocumentsService.renderConsommationsExport,
// inchangé).
const FAMILLE_VERS_LIBELLE = new Map<string, string>(GROUPES_ACTES.flatMap((g) => g.familles.map((f) => [f, g.label] as const)));

export function libelleGroupeDeFamille(famille: string | null | undefined): string | undefined {
  return famille ? FAMILLE_VERS_LIBELLE.get(famille) : undefined;
}
