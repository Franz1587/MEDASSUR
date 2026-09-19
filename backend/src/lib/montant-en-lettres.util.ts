// Écriture d'un montant en toutes lettres, en français (2026-09) — voir
// demande utilisateur : documents de référence "FACTURE SANTE MP 1ER TRIM
// 2026.pdf" ("DEUX CENT QUATRE-VINGT SEIZE MILLIONS QUATRE CENT QUATRE-VINGT
// DEUX MILLE DEUX CENT VINGT SIX FRANCS CFA") et
// "modele_lettre_et_cheque_specimen.pdf" ("La somme de : [MONTANT EN
// LETTRES]"). Aucun utilitaire équivalent n'existait dans le backend.
//
// Orthographe calquée sur le document de référence : les mots composés
// fixes (QUATRE-VINGT, SOIXANTE-DIX) gardent leur trait d'union interne,
// mais l'unité qui suit une dizaine est séparée par un ESPACE, jamais un
// trait d'union ("QUATRE-VINGT SEIZE", "QUATRE-VINGT DEUX" — vérifié sur le
// modèle, pas "quatre-vingt-deux" en continu comme l'orthographe classique).
const UNITES = ["", "UN", "DEUX", "TROIS", "QUATRE", "CINQ", "SIX", "SEPT", "HUIT", "NEUF"];
const DIX_A_SEIZE = ["DIX", "ONZE", "DOUZE", "TREIZE", "QUATORZE", "QUINZE", "SEIZE"];
// Index 0..9 (dizaines 0/10/20…90) — 10 et 70/90 sont dérivés dans le calcul.
const DIZAINES = ["", "DIX", "VINGT", "TRENTE", "QUARANTE", "CINQUANTE", "SOIXANTE", "SOIXANTE-DIX", "QUATRE-VINGT", "QUATRE-VINGT-DIX"];

function dizaineUniteEnLettres(n: number): string {
  // n entre 0 et 99
  if (n < 17) return n === 0 ? "" : n < 10 ? UNITES[n] : DIX_A_SEIZE[n - 10];
  if (n < 20) return `DIX-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) {
    // 70-79 : SOIXANTE-DIX + unité (11..19 -> DIX_A_SEIZE/DIX-x) ; 90-99 idem sur QUATRE-VINGT-DIX
    const base = d === 7 ? "SOIXANTE" : "QUATRE-VINGT";
    const reste = n - (d === 7 ? 60 : 80);
    return reste < 17 ? `${base} ${DIX_A_SEIZE[reste - 10] ?? UNITES[reste]}` : `${base} DIX-${UNITES[reste - 10]}`;
  }
  if (u === 0) return DIZAINES[d];
  if (u === 1 && d !== 8) return `${DIZAINES[d]} ET UN`;
  return `${DIZAINES[d]} ${UNITES[u]}`;
}

function centainesEnLettres(n: number): string {
  if (n === 0) return "";
  const c = Math.floor(n / 100);
  const reste = n % 100;
  const parts: string[] = [];
  if (c > 0) parts.push(c === 1 ? "CENT" : `${UNITES[c]} CENT${reste === 0 ? "S" : ""}`);
  const dv = dizaineUniteEnLettres(reste);
  if (dv) parts.push(dv);
  return parts.join(" ");
}

function trancheEnLettres(n: number, singulier: string, pluriel: string): string {
  if (n === 0) return "";
  if (singulier === "MILLE") return n === 1 ? "MILLE" : `${centainesEnLettres(n)} MILLE`;
  return `${centainesEnLettres(n)} ${n > 1 ? pluriel : singulier}`;
}

/** 296482226 -> "DEUX CENT QUATRE-VINGT SEIZE MILLIONS QUATRE CENT QUATRE-VINGT DEUX MILLE DEUX CENT VINGT SIX" (sans unité monétaire). */
export function montantEnLettres(montant: number): string {
  const n = Math.round(Math.abs(montant));
  if (n === 0) return "ZERO";
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1_000);
  const unites = n % 1_000;
  const parts = [
    trancheEnLettres(milliards, "MILLIARD", "MILLIARDS"),
    trancheEnLettres(millions, "MILLION", "MILLIONS"),
    trancheEnLettres(milliers, "MILLE", "MILLE"),
    centainesEnLettres(unites),
  ].filter(Boolean);
  return parts.join(" ");
}

/** Même chose, suffixée "FRANCS CFA" — forme utilisée sur les factures/lettres (montant arrêté). */
export function montantEnLettresFcfa(montant: number): string {
  return `${montantEnLettres(montant)} FRANCS CFA`;
}
