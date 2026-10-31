// Carte administrative du Gabon — 9 provinces avec villes principales.
// Utilisé pour le tri du Réseau de Soins PDF.

export const ORDRE_PROVINCES = [
  "Estuaire",
  "Ogooué-Maritime",
  "Haut-Ogooué",
  "Ngounié",
  "Woleu-Ntem",
  "Nyanga",
  "Ogooué-Lolo",
  "Moyen-Ogooué",
  "Ogooué-Ivindo",
] as const;

export type ProvinceGabon = (typeof ORDRE_PROVINCES)[number];

// Capitales provinciales en premier, puis autres villes dans l'ordre logique.
const CAPITALES_PROVINCE: Record<string, string[]> = {
  "Estuaire":        ["libreville", "akanda", "angondje", "angondjo", "owendo", "oloumi", "ntoum", "kango", "cocobeach"],
  "Ogooué-Maritime": ["port gentil", "portgentil", "gamba", "omboue"],
  "Haut-Ogooué":     ["franceville", "moanda", "mounana", "okondja", "lekoni", "bakoumba", "akieni", "masuku"],
  "Ngounié":         ["mouila", "fougamou", "ndende", "mbigou", "mimongo"],
  "Woleu-Ntem":      ["oyem", "bitam", "mitzic", "minvoul", "medouneu"],
  "Nyanga":          ["tchibanga", "mayumba", "ndindi", "tsogni"],
  "Ogooué-Lolo":     ["koulamoutou", "lastoursville"],
  "Moyen-Ogooué":    ["lambarene", "ndjole", "sindara"],
  "Ogooué-Ivindo":   ["makokou", "booue", "mekambo"],
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[àâä]/g, "a").replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i").replace(/[ôö]/g, "o")
    .replace(/[ùûü]/g, "u").replace(/[ç]/g, "c")
    .replace(/[-]/g, " ").trim();
}

const VILLE_PROVINCE: [string, ProvinceGabon][] = [
  ["libreville", "Estuaire"], ["akanda", "Estuaire"], ["angondje", "Estuaire"],
  ["angondjo", "Estuaire"], ["nzeng ayong", "Estuaire"],
  ["owendo", "Estuaire"], ["oloumi", "Estuaire"],
  ["ntoum", "Estuaire"], ["nkan", "Estuaire"], ["cocobeach", "Estuaire"], ["kango", "Estuaire"],
  ["port gentil", "Ogooué-Maritime"], ["portgentil", "Ogooué-Maritime"],
  ["gamba", "Ogooué-Maritime"], ["omboue", "Ogooué-Maritime"],
  ["franceville", "Haut-Ogooué"], ["moanda", "Haut-Ogooué"], ["mounana", "Haut-Ogooué"],
  ["okondja", "Haut-Ogooué"], ["lekoni", "Haut-Ogooué"], ["masuku", "Haut-Ogooué"],
  ["bakoumba", "Haut-Ogooué"], ["akieni", "Haut-Ogooué"],
  ["mouila", "Ngounié"], ["fougamou", "Ngounié"], ["ndende", "Ngounié"],
  ["mbigou", "Ngounié"], ["mimongo", "Ngounié"],
  ["oyem", "Woleu-Ntem"], ["bitam", "Woleu-Ntem"], ["mitzic", "Woleu-Ntem"],
  ["minvoul", "Woleu-Ntem"], ["medouneu", "Woleu-Ntem"],
  ["tchibanga", "Nyanga"], ["tsogni", "Nyanga"], ["mayumba", "Nyanga"], ["ndindi", "Nyanga"],
  ["koulamoutou", "Ogooué-Lolo"], ["lastoursville", "Ogooué-Lolo"],
  ["lambarene", "Moyen-Ogooué"], ["ndjole", "Moyen-Ogooué"], ["sindara", "Moyen-Ogooué"],
  ["makokou", "Ogooué-Ivindo"], ["booue", "Ogooué-Ivindo"], ["mekambo", "Ogooué-Ivindo"],
];

export function provinceDeVille(ville: string | null | undefined): ProvinceGabon | null {
  if (!ville) return null;
  const v = norm(ville);
  for (const [k, prov] of VILLE_PROVINCE) {
    if (v === k || v.startsWith(k) || k.startsWith(v)) return prov;
  }
  return null;
}

export function prioriteVilleDansProvince(ville: string, province: string): number {
  const caps = CAPITALES_PROVINCE[province] ?? [];
  const v = norm(ville);
  const idx = caps.findIndex((c) => v === c || v.startsWith(c) || c.startsWith(v));
  return idx === -1 ? 99 : idx;
}
