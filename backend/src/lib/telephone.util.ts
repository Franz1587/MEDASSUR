// Numéros de téléphone (2026-08) — voir demande utilisateur : "enlève les
// points sur les numéros de téléphone des prestataires... 077.66.00.01...
// doivent devenir 077660001. Maintenant il faut prévoir dans
// l'enregistrement du numéro dans le contrat l'indicatif du pays du
// contrat. Ce qui fait que peu importe que le numéro soit écrit avec
// l'indicatif ou pas, l'application orientera le flux de message vers le
// bon numéro avec le bon indicatif. Tous les numéros de l'application
// doivent s'écrire comme dans le modèle modifié après retrait des '.'"

// Indicatifs pays (2026-08) — couvre le Gabon (marché unique de
// l'application, voir tropicalisation Gabon-only) et les pays déjà
// référencés ailleurs dans l'app (Contrat.extensionsTerritorialite : Zone
// CEMAC, France, International) — pas une liste mondiale exhaustive,
// complétée au besoin plutôt que devinée pour un pays absent.
const INDICATIFS_PAYS: Record<string, string> = {
  "Gabon": "+241",
  "Cameroun": "+237",
  "Congo": "+242",
  "République du Congo": "+242",
  "Tchad": "+235",
  "République Centrafricaine": "+236",
  "Centrafrique": "+236",
  "Guinée Équatoriale": "+240",
  "France": "+33",
};

// Nettoie un numéro saisi n'importe comment (points, espaces, tirets) en
// une chaîne de chiffres compacte — voir demande utilisateur : "077.66.00.01
// ... doivent devenir 077660001". Conserve un "+" de tête s'il est déjà
// présent (numéro déjà saisi avec son indicatif). Ne touche jamais un champ
// qui contient plusieurs numéros séparés par "·" (voir Prestataire.telephone) —
// applique le nettoyage à CHAQUE numéro du groupe, jamais au séparateur.
export function normaliserTelephone(numero: string | null | undefined): string | null | undefined {
  if (numero == null) return numero;
  const nettoyerUn = (s: string) => {
    const brut = s.trim();
    if (!brut) return "";
    const garderPlus = brut.startsWith("+");
    const chiffres = brut.replace(/[^\d]/g, "");
    return garderPlus ? `+${chiffres}` : chiffres;
  };
  return numero.split("·").map((s) => nettoyerUn(s)).filter(Boolean).join(" · ") || numero;
}

// Retourne le numéro avec son indicatif pays si celui-ci n'en a pas déjà
// un — voir demande utilisateur : "peu importe que le numéro soit écrit
// avec l'indicatif ou pas, l'application orientera le flux de message vers
// le bon numéro avec le bon indicatif." Un "0" de tête (préfixe de
// composition local) est retiré avant d'ajouter l'indicatif, comme pour
// toute composition internationale (ex. Gabon : 077660001 → +24177660001,
// jamais +2410776600...). Sans pays connu, renvoie le numéro nettoyé tel
// quel plutôt que d'inventer un indicatif.
export function telephoneAvecIndicatif(numero: string | null | undefined, pays: string | null | undefined): string | null | undefined {
  const propre = normaliserTelephone(numero);
  if (!propre) return propre;
  if (propre.startsWith("+")) return propre;
  const indicatif = pays ? INDICATIFS_PAYS[pays] : undefined;
  if (!indicatif) return propre;
  const local = propre.replace(/^0+/, "");
  return `${indicatif}${local}`;
}
