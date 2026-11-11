import type {
  AnalyseNarrative, AnalyseSection, EvolutionMensuelleLigne, RepartitionBeneficiaireLigne,
  RepartitionLigne, SpBloc,
} from "./statistiques.types";

// Moteur de règles déterministe (2026-08) — voir demande utilisateur :
// "grâce à l'IA... rendre possible l'analyse des données statistiques à
// chaque génération et selon les données à la minute même où la
// statistique est générée". Décision actée : pas d'appel à un LLM externe
// (pas de clé API, coût, variabilité indésirable sur un document
// actuariel) — un moteur de règles reproduit la structure du modèle
// (Analyse / Interprétation / Point de vigilance / verdicts OK/ATTENTION) à
// partir des seuils documentés ci-dessous, appliqués aux chiffres réels
// calculés en direct pour CE contrat et CETTE période.
//
// Note police : les fonts standards PDFKit (Helvetica) sont encodées en
// WinAnsi (Latin-1) — les symboles ✓/⚠️/→/≈ hors de ce jeu de caractères
// se rendent en glyphes cassés dans le PDF. On utilise donc des libellés
// ASCII ("OK —", "ATTENTION —", "->", "~") au lieu des symboles Unicode.
function pct(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
}
function fmt(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ");
}

// Verdict S/P basé sur la clause RÉELLE de la compagnie (2026-11) —
// voir demande utilisateur : "l'analyse n'est pas très exacte concernant
// le s/p et le tableau d'ajustement". Remplace l'ancien verdictSp() qui
// utilisait des seuils génériques (70/90/110%) pouvant CONTREDIRE le
// résultat de la clause : un S/P de 76% classé "à surveiller" alors que
// la compagnie réclame une majoration réelle de 35%. Le verdict est
// désormais déduit exclusivement du regularisationPct calculé par
// trouverTranche() dans statistiques.service.ts.
function verdictDepuisClause(regularisationPct: number): string {
  if (regularisationPct === 0) return "sain";
  if (regularisationPct >= 999) return "résiliation";
  if (regularisationPct <= 20) return "à surveiller";
  if (regularisationPct <= 50) return "limite";
  return "déficitaire";
}

function analyseConsommationTotale(evolution: EvolutionMensuelleLigne[], total: number, du: string, au: string, periodeCloturee: boolean): AnalyseSection {
  const lignes = [
    `Montant total consommé : ${fmt(total)} FCFA`,
    `Période : du ${du} au ${au}`,
    "",
    "Évolution mensuelle",
    "",
    ...evolution.map((m) => `${m.label} : ${fmt(m.montant)} FCFA`),
    "",
    "Analyse",
    "",
  ];
  if (evolution.length >= 2) {
    const premier = evolution[0].montant;
    const dernier = evolution[evolution.length - 1].montant;
    const evolutionPct = premier > 0 ? ((dernier - premier) / premier) * 100 : 0;
    const pic = evolution.reduce((max, m) => (m.montant > max.montant ? m : max), evolution[0]);
    lignes.push(`Évolution entre ${evolution[0].label} et ${evolution[evolution.length - 1].label} : ${evolutionPct >= 0 ? "+" : ""}${pct(evolutionPct)}`);
    lignes.push(`Mois le plus consommateur : ${pic.label} (${fmt(pic.montant)} FCFA)`);
    const variations = evolution.slice(1).map((m, i) => m.montant - evolution[i].montant);
    const enHausseConstante = variations.every((v) => v >= 0);
    const enBaisseConstante = variations.every((v) => v <= 0);
    // Langage rétrospectif ("a progressé") pour un exercice clôturé — voir
    // demande utilisateur : l'analyse d'une période déjà terminée ne doit
    // jamais parler "en prévision" (ex. "tendance à surveiller si elle se
    // poursuit" n'a pas de sens quand il n'y a plus de suite possible).
    if (enHausseConstante && variations.some((v) => v > 0)) lignes.push(periodeCloturee ? "Progression continue constatée sur l'ensemble de l'exercice." : "Progression continue sur la période — tendance à surveiller si elle se poursuit.");
    else if (enBaisseConstante && variations.some((v) => v < 0)) lignes.push("Consommation en repli continu sur la période.");
    else lignes.push("Profil irrégulier d'un mois sur l'autre, sans tendance continue nette.");
  } else {
    lignes.push("Un seul mois de données disponible sur la période — pas assez de recul pour une tendance.");
  }
  const derniveElevee = evolution.length >= 2 && evolution[evolution.length - 1].montant > evolution[0].montant * 1.3;
  lignes.push("", periodeCloturee ? "Bilan de l'exercice :" : "Point de vigilance :", "", periodeCloturee
    ? (derniveElevee
      ? "L'exercice s'est terminé sur un niveau de consommation élevé par rapport au début de la période — bilan définitif, sans projection au-delà puisque l'exercice est clôturé."
      : "Aucune dérive marquée constatée sur l'ensemble de cet exercice clôturé.")
    : (derniveElevee
      ? "Le contrat entre dans une phase de consommation élevée, ce qui peut entraîner une dérive accélérée sur l'année si la tendance se poursuit."
      : "Aucune dérive marquée détectée sur la période observée."));
  return { titre: "1. Consommation Totale", lignes };
}

function analyseBeneficiaire(groupes: RepartitionBeneficiaireLigne[]): AnalyseSection {
  const lignes: string[] = [];
  for (const g of groupes) {
    lignes.push(g.type, `Montant : ${fmt(g.montant)} FCFA (${pct(g.pctDepenses)})`, `Effectif : ${g.nombre} personnes (${pct(g.pctPopulation)})`, "");
  }
  lignes.push("Analyse", "");
  const enfants = groupes.find((g) => g.type === "Enfants");
  const conjoints = groupes.find((g) => g.type === "Conjoints");
  const principaux = groupes.find((g) => g.type === "Assurés Principaux");
  if (enfants) lignes.push(`Les enfants représentent ${pct(enfants.pctPopulation)} de la population pour ${pct(enfants.pctDepenses)} de la dépense — ${enfants.pctDepenses <= enfants.pctPopulation + 5 ? "niveau cohérent avec leur poids démographique" : "consommation élevée au regard de leur poids démographique"}.`);
  if (principaux) lignes.push(`Les assurés principaux pèsent ${pct(principaux.pctDepenses)} de la dépense pour ${pct(principaux.pctPopulation)} de la population — ${Math.abs(principaux.pctDepenses - principaux.pctPopulation) <= 10 ? "répartition équilibrée" : "écart notable à surveiller"}.`);
  if (conjoints) {
    const ratioCoutEffectif = conjoints.pctPopulation > 0 ? conjoints.pctDepenses / conjoints.pctPopulation : 0;
    lignes.push(`Les conjoints représentent ${pct(conjoints.pctDepenses)} de la dépense pour ${pct(conjoints.pctPopulation)} de la population — ${ratioCoutEffectif > 1.3 ? "ratio coût/effectif élevé, point de vigilance" : "ratio coût/effectif maîtrisé"}.`);
  }
  const ecartMax = Math.max(...groupes.map((g) => Math.abs(g.pctDepenses - g.pctPopulation)));
  lignes.push("", ecartMax <= 15 ? "OK — Structure globalement équilibrée" : "ATTENTION — Structure déséquilibrée entre effectif et dépense selon les catégories");
  return { titre: "2. Répartition par Bénéficiaire", lignes };
}

// Seuils "standards marché" utilisés pour qualifier chaque poste de
// consommation — reproduisent le principe du modèle (ex. Optique jugée
// "très élevée" au-delà de 15%) sans dépendre d'un jeu de données précis :
// applicables à n'importe quel contrat/période.
const SEUILS_RUBRIQUE: Record<string, { eleve: number; label: string }> = {
  OPTIQUE: { eleve: 15, label: "standards marché (10–15%)" },
  PHARMACIE: { eleve: 25, label: "portefeuille actif (15–25%)" },
  HOSPITALISATION: { eleve: 20, label: "sinistralité lourde (10–20%)" },
  CONSULTATIONS: { eleve: 20, label: "soins courants (10–20%)" },
  "SOINS & PROTHESES DENTAIRE": { eleve: 12, label: "standards marché (5–12%)" },
};

function analyseRubrique(rubriques: RepartitionLigne[]): AnalyseSection {
  const top = rubriques.slice(0, 6);
  const lignes = ["Principaux postes", "", ...top.map((r) => `${r.libelle} : ${fmt(r.montant)} FCFA (${pct(r.pct)})`), "", "Analyse", ""];
  for (const r of top) {
    const seuil = SEUILS_RUBRIQUE[r.libelle.toUpperCase()];
    if (seuil && r.pct > seuil.eleve) lignes.push(`${r.libelle} (${pct(r.pct)}) = élevé, au-dessus des ${seuil.label} — poste à surveiller en priorité.`);
    else if (seuil) lignes.push(`${r.libelle} (${pct(r.pct)}) = dans les ${seuil.label} — niveau cohérent.`);
  }
  const soinsCourants = rubriques.filter((r) => ["CONSULTATIONS", "PHARMACIE", "EXAMENS LABORATOIRE"].includes(r.libelle.toUpperCase())).reduce((s, r) => s + r.pct, 0);
  if (soinsCourants > 0) lignes.push(`Soins courants (consultations + pharmacie + labo ~ ${pct(soinsCourants)}) — niveau ${soinsCourants > 50 ? "élevé" : "cohérent"}.`);
  const posteDominant = rubriques[0];
  lignes.push("", posteDominant && SEUILS_RUBRIQUE[posteDominant.libelle.toUpperCase()]?.eleve && posteDominant.pct > SEUILS_RUBRIQUE[posteDominant.libelle.toUpperCase()].eleve
    ? `ATTENTION — Point critique : surconsommation en ${posteDominant.libelle.toLowerCase()}`
    : "OK — Aucun poste ne ressort comme anormalement élevé");
  return { titre: "3. Répartition par Rubrique", lignes };
}

function analysePrestataire(prestataires: RepartitionLigne[]): AnalyseSection {
  const top6 = prestataires.slice(0, 6);
  const lignes = ["Top prestataires", "", ...top6.map((p) => `${p.libelle} : ${fmt(p.montant)} FCFA (${pct(p.pct)})`), "", "Analyse", ""];
  const concentrationTop5 = prestataires.slice(0, 5).reduce((s, p) => s + p.pct, 0);
  lignes.push(`Les 5 premiers prestataires concentrent ${pct(concentrationTop5)} de la consommation.`);
  lignes.push(concentrationTop5 > 40
    ? "  -> réseau dépendant de quelques acteurs clés."
    : "  -> réseau diversifié, consommation répartie sur un grand nombre de prestataires.");
  lignes.push("", concentrationTop5 > 40 ? "OK — Réseau structuré, mais dominé par certains acteurs clés" : "OK — Réseau diversifié");
  return { titre: "4. Consommation par Prestataire", lignes };
}

// Tableau complet des clauses d'ajustement de la compagnie (2026-11) —
// voir demande utilisateur : "le tableau d'ajustement de prime des
// différentes compagnies doit être précis et correct".
// spMin/spMax sont stockés en ratio (0.75 = 75%) — formatBorne * 100.
function lignesTableauClauses(clauses: { spMin: number; spMax: number | null; tauxAjustement: number }[]): string[] {
  if (clauses.length === 0) return ["(Aucune clause d'ajustement renseignée pour cette compagnie.)"];
  const fb = (v: number) => `${Math.round(v * 100)} %`;
  return clauses.map((c) => {
    const borne = c.spMax === null ? `S/P >= ${fb(c.spMin)}` : `${fb(c.spMin)} <= S/P <= ${fb(c.spMax)}`;
    const taux = c.tauxAjustement >= 999 ? "Résiliation / majoration non plafonnée" : c.tauxAjustement === 0 ? "Aucun ajustement" : `Majoration de prime : +${c.tauxAjustement} %`;
    return `  ${borne}  =>  ${taux}`;
  });
}

function analyseSp(
  sans: SpBloc, avec: SpBloc,
  clauses: { spMin: number; spMax: number | null; tauxAjustement: number }[],
): AnalyseSection {
  const lignes = [
    "Sans chargement", "",
    `Sinistres : ${fmt(sans.sinistres)} FCFA`, `Primes : ${fmt(sans.primes)} FCFA`, `S/P : ${pct(sans.ratioPct)}`,
    "", "Avec chargement", "",
    `Sinistres chargés : ${fmt(avec.sinistres)} FCFA`, `Primes : ${fmt(avec.primes)} FCFA`, `S/P : ${pct(avec.ratioPct)}`,
    "", "Tableau des clauses d'ajustement de la compagnie", "",
    ...lignesTableauClauses(clauses),
  ];
  return { titre: "5. Analyse du Rapport S/P (Sinistres / Primes)", lignes };
}

function conclusionSp(sans: SpBloc, avec: SpBloc): AnalyseSection {
  // Verdict dérivé de la clause réelle, plus des seuils génériques (70/90/110%)
  const verdictSans = verdictDepuisClause(sans.regularisationPct);
  const verdictAvec = verdictDepuisClause(avec.regularisationPct);
  const lignes = [
    "Sans chargement",
    `S/P : ${pct(sans.ratioPct)} — ${verdictSans}`,
    `Tranche applicable : ${sans.tranche}`,
    `Ajustement de prime selon clause : ${sans.regularisationPct >= 999 ? "Résiliation" : sans.regularisationPct === 0 ? "Aucun" : `+${pct(sans.regularisationPct)}`}`,
    "", "Avec chargement",
    `S/P : ${pct(avec.ratioPct)} — ${verdictAvec}`,
    `Tranche applicable : ${avec.tranche}`,
    `Ajustement de prime selon clause : ${avec.regularisationPct >= 999 ? "Résiliation" : avec.regularisationPct === 0 ? "Aucun" : `+${pct(avec.regularisationPct)}`}`,
  ];
  return { titre: "6. Conclusion S/P", lignes };
}

export function genererAnalyseNarrative(donnees: {
  evolutionMensuelle: EvolutionMensuelleLigne[];
  totalConsomme: number;
  periode: { du: string; au: string };
  repartitionBeneficiaire: RepartitionBeneficiaireLigne[];
  consommationParRubrique: RepartitionLigne[];
  consommationParPrestataire: RepartitionLigne[];
  spSansChargement: SpBloc;
  spAvecChargement: SpBloc;
  // Clauses d'ajustement complètes de la compagnie (2026-11) — passées
  // ici pour afficher le tableau ENTIER dans la section S/P et non
  // seulement la tranche matchée. spMin/spMax en ratio (0–1).
  clausesAjustement?: { spMin: number; spMax: number | null; tauxAjustement: number }[];
  // Exercice(s) recouvrant la période DÉJÀ clôturé(s) (2026-09) — voir
  // StatistiquesService.calculer. Bascule l'ensemble de cette analyse d'un
  // langage prédictif ("si la tendance se poursuit", "projection annuelle")
  // vers un langage rétrospectif et définitif (résultat S/P réel + clause
  // d'ajustement effectivement applicable) — voir demande utilisateur :
  // "l'analyse ne devrait pas parler en prévision d'une statistique dont
  // l'exercice est déjà clôturée... ça devrait être une analyse exacte
  // quant à la police et ses consommations par rapport aux clauses
  // d'ajustement." Absent/false = comportement inchangé (exercice encore
  // Actif/En renouvellement, déjà vérifié en conditions réelles).
  periodeCloturee?: boolean;
}): AnalyseNarrative {
  const periodeCloturee = donnees.periodeCloturee ?? false;
  const clauses = donnees.clausesAjustement ?? [];
  const sections = [
    analyseConsommationTotale(donnees.evolutionMensuelle, donnees.totalConsomme, donnees.periode.du, donnees.periode.au, periodeCloturee),
    analyseBeneficiaire(donnees.repartitionBeneficiaire),
    analyseRubrique(donnees.consommationParRubrique),
    analysePrestataire(donnees.consommationParPrestataire),
    analyseSp(donnees.spSansChargement, donnees.spAvecChargement, clauses),
    conclusionSp(donnees.spSansChargement, donnees.spAvecChargement),
  ];

  const posteDominant = donnees.consommationParRubrique[0];
  const facteursDerive = [posteDominant?.libelle, "la pharmacie", "les gros consommateurs"].filter((v, i, arr) => v && arr.indexOf(v) === i);

  // Verdict basé sur la clause réelle de la compagnie (2026-11) — voir
  // commentaire sur verdictDepuisClause() ci-dessus. L'ancien `sain =
  // ratioPct < 90` hardcodé pouvait contredire un tableau d'ajustement
  // réel (ex. S/P 76% dit "sain" mais la compagnie réclame +35%).
  const regularisationDue = donnees.spSansChargement.regularisationPct !== 0;
  const sain = !regularisationDue;

  const conclusionGenerale = [
    "Le contrat présente :", "",
    `• une sinistralité ${sain ? "maîtrisée" : "en zone d'ajustement"} sur la période observée (S/P ${pct(donnees.spSansChargement.ratioPct)} sans chargement)`,
    periodeCloturee ? "• une dynamique de consommation actée sur l'ensemble de l'exercice, désormais clôturé" : "• une dynamique de consommation à surveiller sur la durée du contrat",
    periodeCloturee ? "• les postes ayant le plus contribué à la consommation de l'exercice :" : "• une dérive potentielle liée principalement à :",
    ...facteursDerive.map((f) => `   - ${f}`),
  ];

  // Exercice CLÔTURÉ : bilan définitif, aucune projection (la période
  // analysée est déjà terminée — extrapoler "sur 12 mois" n'a plus de
  // sens). Exercice encore en cours : projection annuelle inchangée
  // (extrapolation linéaire de la moyenne mensuelle observée sur 12 mois,
  // déjà vérifiée en conditions réelles).
  let projection: AnalyseNarrative["projection"];
  if (periodeCloturee) {
    projection = {
      titre: "Résultat de l'exercice",
      spProjeteMin: donnees.spSansChargement.ratioPct, spProjeteMax: donnees.spAvecChargement.ratioPct, montantAnnuelEstime: donnees.totalConsomme,
      lignes: [
        "Exercice clôturé — résultat définitif de la période, aucune projection au-delà :", "",
        `• Consommation totale actée : ${fmt(donnees.totalConsomme)} FCFA`,
        `• S/P final sans chargement : ${pct(donnees.spSansChargement.ratioPct)} (${donnees.spSansChargement.tranche})`,
        `• S/P final avec chargement : ${pct(donnees.spAvecChargement.ratioPct)} (${donnees.spAvecChargement.tranche})`,
      ],
    };
  } else {
    const moyenneMensuelle = donnees.evolutionMensuelle.length > 0
      ? donnees.evolutionMensuelle.reduce((s, m) => s + m.montant, 0) / donnees.evolutionMensuelle.length
      : 0;
    const montantAnnuelEstime = moyenneMensuelle * 12;
    const spProjeteMin = donnees.spSansChargement.primes > 0 ? (montantAnnuelEstime / donnees.spSansChargement.primes) * 100 * 0.9 : 0;
    const spProjeteMax = donnees.spSansChargement.primes > 0 ? (montantAnnuelEstime / donnees.spSansChargement.primes) * 100 * 1.1 : 0;
    // Tendance réelle (2026-11) — l'ancien texte disait toujours "passe
    // à un niveau plus élevé" même quand la consommation baissait.
    const evolution = donnees.evolutionMensuelle;
    const tendance = evolution.length >= 2
      ? (evolution[evolution.length - 1].montant >= evolution[0].montant ? "à la hausse" : "à la baisse")
      : "stable";
    const premierMois = evolution[0]?.label ?? "—";
    const dernierMois = evolution[evolution.length - 1]?.label ?? "—";
    projection = {
      titre: "Projection",
      spProjeteMin, spProjeteMax, montantAnnuelEstime,
      lignes: [
        `Tendance observée de ${premierMois} à ${dernierMois} : ${tendance}.`,
        "Si la tendance se maintient :", "",
        `• Projection annuelle estimée : ~ ${fmt(montantAnnuelEstime)} FCFA`,
        `• S/P projeté : ~ ${pct(spProjeteMin)} – ${pct(spProjeteMax)}`,
      ],
    };
  }

  // Résultat des clauses d'ajustement (tranche/régularisation) — déjà
  // calculé EXACTEMENT par StatistiquesService.trouverTranche, jamais
  // réestimé ici : un exercice clôturé énonce ce résultat comme un fait
  // acquis (régularisation à appliquer ou non), jamais comme une
  // probabilité.
  const conclusionStrategique = periodeCloturee
    ? [
      `• Résultat définitif (sans chargement) : S/P ${pct(donnees.spSansChargement.ratioPct)} — tranche ${donnees.spSansChargement.tranche}`,
      `• Ajustement de prime applicable selon clause compagnie : ${donnees.spSansChargement.regularisationPct >= 999 ? "Résiliation" : donnees.spSansChargement.regularisationPct === 0 ? "Aucun" : `+${pct(donnees.spSansChargement.regularisationPct)}`}`,
      donnees.spSansChargement.regularisationPct !== 0
        ? "• Ajustement de prime à appliquer au prochain exercice, conformément à cette clause."
        : "• Aucun ajustement de prime requis d'après cette clause.",
    ]
    : ["• Surveillance du portefeuille recommandée", "• Ajustement de prime probable au prochain exercice si la tendance se confirme"];

  const hausseFinPeriode = donnees.evolutionMensuelle.length >= 2 && donnees.evolutionMensuelle[donnees.evolutionMensuelle.length - 1].montant > donnees.evolutionMensuelle[0].montant * 1.2;
  const conclusionFinale = periodeCloturee
    ? [
      "L'exercice clôturé est :", "",
      sain ? "OK — Résultat sain sur l'ensemble de la période" : "ATTENTION — Résultat en zone de vigilance sur l'ensemble de la période",
      hausseFinPeriode ? "ATTENTION — Exercice terminé sur une hausse de consommation marquée en fin de période" : "OK — Évolution maîtrisée sur l'ensemble de l'exercice",
      "",
      regularisationDue
        ? `Un ajustement de prime est à appliquer au prochain exercice, conformément à la clause d'ajustement de la compagnie (régularisation ${donnees.spSansChargement.regularisationPct >= 999 ? "résiliation" : `+${pct(donnees.spSansChargement.regularisationPct)}`}).`
        : "Aucun ajustement de prime requis — le S/P constaté sur cet exercice reste dans la tranche sans régularisation de la clause d'ajustement.",
    ]
    : [
      "Le contrat est :", "",
      sain ? "OK — Sain à ce jour (aucun ajustement requis selon la clause compagnie)" : "ATTENTION — En zone d'ajustement selon la clause compagnie",
      hausseFinPeriode ? "ATTENTION — En phase de montée en charge" : "OK — Avec une évolution maîtrisée",
      "", sain
        ? "Le S/P reste dans la tranche sans ajustement — pas d'action requise sur la prime à ce stade."
        : "Un ajustement de prime est probable au prochain exercice si la dynamique actuelle se maintient.",
    ];

  return { sections, conclusionGenerale, projection, conclusionStrategique, conclusionFinale };
}
