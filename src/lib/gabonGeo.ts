// Carte administrative du Gabon — 9 provinces avec leurs villes principales.
// Source : Wikipedia / découpage officiel du Gabon.
// Utilisé pour l'affichage groupé du Réseau de soins (province → ville → type).

export const PROVINCES_GABON = [
  "Estuaire",
  "Haut-Ogooué",
  "Moyen-Ogooué",
  "Ngounié",
  "Nyanga",
  "Ogooué-Ivindo",
  "Ogooué-Lolo",
  "Ogooué-Maritime",
  "Woleu-Ntem",
] as const;

export type ProvinceGabon = (typeof PROVINCES_GABON)[number];

// Normalisation : minuscules, suppression des accents.
function norm(s: string): string {
  return s.toLowerCase()
    .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e").replace(/[îï]/g, "i")
    .replace(/[ôö]/g, "o").replace(/[ùûü]/g, "u").replace(/[ç]/g, "c")
    .replace(/[-]/g, " ").trim();
}

const VILLE_PROVINCE: [string, ProvinceGabon][] = [
  // Estuaire
  ["libreville",  "Estuaire"],
  ["akanda",      "Estuaire"],
  ["owendo",      "Estuaire"],
  ["ntoum",       "Estuaire"],
  ["nkan",        "Estuaire"],
  ["cocobeach",   "Estuaire"],
  ["kango",       "Estuaire"],
  // Ogooué-Maritime
  ["port gentil", "Ogooué-Maritime"],
  ["portgentil",  "Ogooué-Maritime"],
  ["gamba",       "Ogooué-Maritime"],
  ["omboue",      "Ogooué-Maritime"],
  // Haut-Ogooué
  ["franceville", "Haut-Ogooué"],
  ["moanda",      "Haut-Ogooué"],
  ["mounana",     "Haut-Ogooué"],
  ["okondja",     "Haut-Ogooué"],
  ["lekoni",      "Haut-Ogooué"],
  ["masuku",      "Haut-Ogooué"],
  ["bakoumba",    "Haut-Ogooué"],
  ["akieni",      "Haut-Ogooué"],
  // Ngounié
  ["mouila",      "Ngounié"],
  ["fougamou",    "Ngounié"],
  ["ndende",      "Ngounié"],
  ["mbigou",      "Ngounié"],
  ["mimongo",     "Ngounié"],
  // Woleu-Ntem
  ["oyem",        "Woleu-Ntem"],
  ["bitam",       "Woleu-Ntem"],
  ["mitzic",      "Woleu-Ntem"],
  ["minvoul",     "Woleu-Ntem"],
  ["medouneu",    "Woleu-Ntem"],
  // Nyanga
  ["tchibanga",   "Nyanga"],
  ["tsogni",      "Nyanga"],
  ["mayumba",     "Nyanga"],
  ["ndindi",      "Nyanga"],
  // Ogooué-Lolo
  ["koulamoutou", "Ogooué-Lolo"],
  ["lastoursville","Ogooué-Lolo"],
  ["pana",        "Ogooué-Lolo"],
  // Moyen-Ogooué
  ["lambarene",   "Moyen-Ogooué"],
  ["ndjole",      "Moyen-Ogooué"],
  ["sindara",     "Moyen-Ogooué"],
  // Ogooué-Ivindo
  ["makokou",     "Ogooué-Ivindo"],
  ["booue",       "Ogooué-Ivindo"],
  ["mekambo",     "Ogooué-Ivindo"],
];

/** Infère la province d'une ville (insensible à la casse et aux accents). */
export function provinceDeVille(ville: string | null | undefined): ProvinceGabon | null {
  if (!ville) return null;
  const v = norm(ville);
  for (const [k, prov] of VILLE_PROVINCE) {
    if (v === k || v.startsWith(k) || k.startsWith(v)) return prov;
  }
  return null;
}
