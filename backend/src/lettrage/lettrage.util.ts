// Moteur de lettrage UNIQUE et réutilisable (2026-09) — voir demande
// utilisateur : "il faut que l'outil IA puisse également faire un vrai
// lettrage de compte" puis "il faudrait vraiment que l'application soit
// synchro et interopérable peu importe les écrans. Les informations
// doivent être uniques." Une SEULE implémentation de l'algorithme,
// utilisée PARTOUT où un compte doit être lettré (comptes clients des
// sociétés côté Super Admin — FactureAbonnementService — et comptes
// clients/fournisseurs internes à chaque société — LettrageService) :
// jamais une logique dupliquée/divergente entre écrans.
//
// Algorithme : lettrage par MONTANT EXACT, appariement FIFO (le plus
// ancien débit d'abord) en cas de plusieurs mouvements au même montant.
// Choix délibéré plutôt qu'un cumul chronologique partiel (méthode plus
// complexe, ambiguë sur QUI a soldé QUOI en cas de règlements fractionnés) :
// dans cette application, un règlement solde TOUJOURS intégralement sa
// pièce d'origine (voir FactureAbonnementService.payer, BordereauReglement.
// payer, QuittanceLibreTranche.encaissementId) — l'appariement par montant
// exact reflète donc fidèlement la réalité, sans reconstituer une logique
// de paiement fractionné qui n'existe pas dans les données.
// Un mouvement dont le montant ne trouve AUCUNE contrepartie exacte reste
// "non lettré" (solde ouvert — impayé réel, ou rapprochement à faire
// manuellement, ex. un règlement partiel jamais modélisé comme tel).

export interface MouvementALettrer {
  id: string;
  date: string; // JJ/MM/AAAA
  libelle: string;
  montant: number; // positif = débit (dû), négatif = crédit (reçu/payé)
}

export interface MouvementLettre extends MouvementALettrer {
  lettre: string | null; // null = non lettré (encore ouvert)
}

export interface ResultatLettrage {
  mouvements: MouvementLettre[];
  soldeNonLettre: number; // > 0 = encore dû, < 0 = trop perçu
  lettrageComplet: boolean;
}

function parseDateFr(s: string): number {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

function prochaineLettre(index: number): string {
  // A, B, ..., Z, AA, AB, ... — comme les colonnes d'un tableur, jamais à
  // court de lettres même pour un compte très mouvementé.
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function lettrerCompte(
  mouvementsBruts: MouvementALettrer[],
  // Paires dont la correspondance est connue avec CERTITUDE via un lien
  // explicite en base (ex. QuittanceLibreTranche.encaissementId) — 2026-09,
  // voir demande utilisateur : "les informations doivent être uniques".
  // Lettrées EN PRIORITÉ, avant l'appariement par montant : nécessaire dès
  // que plusieurs mouvements ambigus partagent le même montant (ex. des
  // tranches de quittance libre toutes égales), où deviner par montant
  // seul pourrait lettrer la mauvaise tranche alors que la vraie
  // correspondance est déjà connue sans ambiguïté.
  pairesConnues: [MouvementALettrer, MouvementALettrer][] = [],
): ResultatLettrage {
  const lettreParId = new Map<string, string>();
  let indexLettre = 0;
  for (const [a, b] of pairesConnues) {
    const lettre = prochaineLettre(indexLettre++);
    lettreParId.set(a.id, lettre);
    lettreParId.set(b.id, lettre);
  }

  const idsConnus = new Set(pairesConnues.flat().map((m) => m.id));
  const tries = [...mouvementsBruts, ...pairesConnues.flat()].sort((a, b) => parseDateFr(a.date) - parseDateFr(b.date));

  // Files FIFO par montant absolu — un débit de 1000 n'est apparié qu'à
  // un crédit de -1000 (ou l'inverse), jamais à un montant approchant.
  // Les mouvements déjà lettrés via une paire connue n'entrent pas dans ces
  // files (ils ne doivent plus être proposés à l'appariement par montant).
  const debitsParMontant = new Map<number, string[]>();
  const creditsParMontant = new Map<number, string[]>();
  for (const m of tries) {
    if (idsConnus.has(m.id)) continue;
    const cle = Math.round(Math.abs(m.montant) * 100);
    const file = m.montant > 0 ? debitsParMontant : creditsParMontant;
    if (!file.has(cle)) file.set(cle, []);
    file.get(cle)!.push(m.id);
  }

  for (const [cle, debits] of debitsParMontant) {
    const credits = creditsParMontant.get(cle);
    if (!credits) continue;
    const nbPaires = Math.min(debits.length, credits.length);
    for (let i = 0; i < nbPaires; i++) {
      const lettre = prochaineLettre(indexLettre++);
      lettreParId.set(debits[i], lettre);
      lettreParId.set(credits[i], lettre);
    }
  }

  const mouvements: MouvementLettre[] = tries.map((m) => ({ ...m, lettre: lettreParId.get(m.id) ?? null }));
  const soldeNonLettre = mouvements.filter((m) => m.lettre === null).reduce((s, m) => s + m.montant, 0);
  return { mouvements, soldeNonLettre: Math.round(soldeNonLettre * 100) / 100, lettrageComplet: Math.abs(soldeNonLettre) < 0.01 };
}
