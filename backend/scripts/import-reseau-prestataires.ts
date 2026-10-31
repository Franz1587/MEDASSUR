/**
 * Import des prestataires depuis les fichiers Excel du réseau de soins.
 * Usage : npx ts-node scripts/import-reseau-prestataires.ts
 *
 * Fichiers attendus (chemin configurable ci-dessous) :
 *   D:/PROJET MEDASSUR/RESEAU DE SOINS LA RUCHE EXCELLENCE 2026.xlsx
 *   D:/PROJET MEDASSUR/prestataires.xls  (tenté en .xlsx si introuvable)
 *
 * Règles :
 *   - Anti-doublon : si un prestataire de même nom (insensible casse) existe
 *     déjà, on skip (jamais de doublon).
 *   - Province déduite de la ville via la carte administrative du Gabon.
 *   - Type déduit de la catégorie Excel + du nom de l'établissement.
 *   - Tous les prestataires importés sont marqués "Conventionné" / "Privé".
 *   - Societe "societe-bootstrap" par défaut (à ajuster selon l'env cible).
 */

import * as path from "path";
import * as fs from "fs";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const SOCIETE_ID = process.env.SOCIETE_ID ?? "ruche-excellence"; // à ajuster

const FILES = [
  path.join("D:/PROJET MEDASSUR/RESEAU DE SOINS LA RUCHE EXCELLENCE 2026.xlsx"),
  path.join("D:/PROJET MEDASSUR/prestataires.xlsx"), // XLS tenté en xlsx
];

// ── Normalisation ────────────────────────────────────────────────────────────

function normStr(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[-–—]/g, " ").replace(/\s+/g, " ").trim();
}

function titreCase(s: string): string {
  return s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

// ── Province depuis la ville ─────────────────────────────────────────────────

const VILLE_PROVINCE: [string, string][] = [
  ["libreville", "Estuaire"], ["akanda", "Estuaire"], ["owendo", "Estuaire"],
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
  ["koulamoutou", "Ogooué-Lolo"], ["lastoursville", "Ogooué-Lolo"], ["pana", "Ogooué-Lolo"],
  ["lambarene", "Moyen-Ogooué"], ["ndjole", "Moyen-Ogooué"], ["sindara", "Moyen-Ogooué"],
  ["makokou", "Ogooué-Ivindo"], ["booue", "Ogooué-Ivindo"], ["mekambo", "Ogooué-Ivindo"],
];

function provinceDeVille(ville: string): string | null {
  const v = normStr(ville);
  for (const [k, prov] of VILLE_PROVINCE) {
    if (v === k || v.startsWith(k + " ") || v.startsWith(k + "(")) return prov;
  }
  return null;
}

// ── Type depuis la catégorie et le nom ───────────────────────────────────────

const CATEGORIE_TYPE: [string, string][] = [
  ["pharmacie", "Pharmacie"],
  ["laboratoire", "Laboratoire"],
  ["labo", "Laboratoire"],
  ["analyse", "Laboratoire"],
  ["imagerie", "Centre d'Imagerie"],
  ["radiologie", "Centre d'Imagerie"],
  ["opticien", "Opticien"],
  ["dentiste", "Cabinet Dentaire"],
  ["dentaire", "Cabinet Dentaire"],
  ["consultation", "Cabinet"],
  ["gyneco", "Cabinet"],
  ["cardiolog", "Cabinet"],
  ["ophtalmolog", "Cabinet"],
  ["orl", "Cabinet"],
  ["dermatolog", "Cabinet"],
  ["endocrino", "Cabinet"],
  ["pediatrie", "Cabinet"],
  ["pediatr", "Cabinet"],
  ["hepato", "Cabinet"],
  ["ortho", "Cabinet"],
  ["neurolog", "Cabinet"],
  ["urolog", "Cabinet"],
  ["pneumolog", "Cabinet"],
  ["nephrolog", "Cabinet"],
  ["gastro", "Cabinet"],
  ["rhumato", "Cabinet"],
  ["infectiolog", "Cabinet"],
  ["hemato", "Cabinet"],
  ["neonato", "Cabinet"],
  ["chirurgi", "Cabinet"],
  ["esthetiqu", "Cabinet"],
  ["soin", "Cabinet"],
];

const NOM_TYPE: [string, string][] = [
  ["polyclinique", "Clinique"],
  ["clinique", "Clinique"],
  ["hopital", "Hôpital"],
  ["hospital", "Hôpital"],
  ["laboratoire", "Laboratoire"],
  ["labo", "Laboratoire"],
  ["pharmacie", "Pharmacie"],
  ["depot pharmaceutique", "Dépôt pharmaceutique"],
  ["opticien", "Opticien"],
  ["optique", "Opticien"],
  ["cabinet dentaire", "Cabinet Dentaire"],
  ["dentaire", "Cabinet Dentaire"],
  ["imagerie", "Centre d'Imagerie"],
];

function typeDepuisCategorie(categorie: string): string {
  const c = normStr(categorie);
  for (const [k, t] of CATEGORIE_TYPE) {
    if (c.includes(k)) return t;
  }
  return "Cabinet";
}

function typeDepuisNom(nom: string, typeCategorie: string): string {
  const n = normStr(nom);
  for (const [k, t] of NOM_TYPE) {
    if (n.includes(k)) return t;
  }
  return typeCategorie;
}

// ── Extraction de la ville depuis l'en-tête de section ───────────────────────

function extraireVille(header: string): string {
  // "LIBREVILLE (Compris AKANDA/OWENDO)" → "Libreville"
  const m = header.match(/^([A-ZÉÀÈÊÎÔÛÙÄËÏ-]+(?:\s[A-ZÉÀÈÊÎÔÛÙÄËÏ-]+)*)/);
  if (!m) return titreCase(header.split("(")[0].trim());
  const raw = m[1].trim();
  // "PORT-GENTIL" → "Port-Gentil"
  return raw.split(/[\s-]/).map((w) => titreCase(w)).join(raw.includes("-") ? "-" : " ");
}

// ── Lecture d'un workbook ─────────────────────────────────────────────────────

interface LigneExcel {
  nom: string;
  telephone: string;
  adresse: string;
  ville: string;
  type: string;
  province: string | null;
}

function estMergedHeader(b: unknown, c: unknown): boolean {
  if (!b || !c) return false;
  const bs = typeof b === "object" ? (b as any).text ?? JSON.stringify(b) : String(b);
  const cs = typeof c === "object" ? (c as any).text ?? JSON.stringify(c) : String(c);
  return bs.trim() === cs.trim() && bs.trim().length > 3;
}

function cellStr(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object") return (v as any).text ?? (v as any).result ?? JSON.stringify(v);
  return String(v).trim();
}

async function lireWorkbook(filePath: string): Promise<LigneExcel[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const lignes: LigneExcel[] = [];
  let villeEnCours = "Libreville";
  let typeEnCours = "Cabinet";

  const CATEGORIES_CONNUES = [
    "CONSULTATIONS", "PHARMACIES", "ANALYSES", "IMAGERIE", "GYNECO", "CARDIOLOG",
    "DENTISTE", "OPHTALMOLOG", "O.R.L", "DERMATOLOG", "OPTICIEN", "ENDOCRINO",
    "PEDIATRIE", "HEPATO", "ORTHO", "NEUROLOG", "UROLOG", "PNEUMOLOG", "NEPHROLOG",
    "GASTRO", "RHUMATO", "INFECTIOLOG", "HEMATO", "NEONATO", "CHIRURGI", "ESTHETIQU",
    "LABORATOIRE", "RADIOLOG",
  ];

  ws.eachRow((row, _i) => {
    const b = row.getCell(2).value;
    const c = row.getCell(3).value;
    const d = row.getCell(4).value;
    const bs = cellStr(b);
    const ds = cellStr(d);

    if (!bs) return;

    if (estMergedHeader(b, c)) {
      const upper = bs.toUpperCase();
      const estCategorie = CATEGORIES_CONNUES.some((k) => upper.startsWith(k));
      if (estCategorie) {
        typeEnCours = typeDepuisCategorie(bs);
      } else if (upper !== "NOM DE L'ETABLISSEMENT" && upper !== "ETRANGER") {
        villeEnCours = extraireVille(bs);
        typeEnCours = "Cabinet"; // reset pour la nouvelle ville
      }
      return;
    }

    if (!bs || bs.toUpperCase() === "NOM DE L'ETABLISSEMENT" || bs.toUpperCase() === "CONTACTS") return;

    const nom = bs.replace(/\s+/g, " ").trim();
    if (!nom || nom.length < 3) return;

    const type = typeDepuisNom(nom, typeEnCours);
    lignes.push({
      nom,
      telephone: cellStr(c).replace(/\s+/g, " ").trim(),
      adresse: ds,
      ville: villeEnCours,
      type,
      province: provinceDeVille(villeEnCours),
    });
  });

  return lignes;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  try {
    // Vérifier la société cible
    const societe = await prisma.societeAssurance.findUnique({ where: { id: SOCIETE_ID }, select: { id: true, nom: true } });
    if (!societe) {
      console.error(`❌ Société « ${SOCIETE_ID} » introuvable. Définissez SOCIETE_ID=<id> dans l'env.`);
      const societes = await prisma.societeAssurance.findMany({ select: { id: true, nom: true } });
      console.log("Sociétés disponibles :", societes.map((s) => `${s.id} — ${s.nom}`).join(", "));
      process.exit(1);
    }
    console.log(`✅ Société cible : ${societe.nom} (${SOCIETE_ID})`);

    // Charger tous les noms existants (insensible casse) pour anti-doublon
    const existants = await prisma.prestataire.findMany({
      where: { societeId: SOCIETE_ID },
      select: { nom: true },
    });
    const nomsExistants = new Set(existants.map((e) => normStr(e.nom)));
    console.log(`📋 ${nomsExistants.size} prestataires existants dans la société.`);

    let crees = 0;
    let skipped = 0;

    for (const filePath of FILES) {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  Fichier introuvable : ${filePath}`);
        continue;
      }
      console.log(`\n📂 Lecture de ${path.basename(filePath)}…`);
      let lignes: LigneExcel[];
      try {
        lignes = await lireWorkbook(filePath);
      } catch (e: any) {
        console.error(`❌ Erreur lecture : ${e.message}`);
        continue;
      }
      console.log(`   ${lignes.length} lignes lues.`);

      for (const l of lignes) {
        const cle = normStr(l.nom);
        if (nomsExistants.has(cle)) {
          skipped++;
          continue;
        }
        nomsExistants.add(cle);

        await prisma.prestataire.create({
          data: {
            id: randomUUID(),
            societeId: SOCIETE_ID,
            nom: l.nom,
            type: l.type,
            secteur: "Privé",
            pays: "Gabon",
            province: l.province ?? undefined,
            ville: l.ville,
            telephone: l.telephone || undefined,
            adresse: l.adresse || undefined,
            statutConvention: "Conventionné",
          },
        });
        crees++;
        if (crees % 20 === 0) process.stdout.write(`   ${crees} créés…\r`);
      }
    }

    console.log(`\n✅ Import terminé — ${crees} prestataire(s) créé(s), ${skipped} doublon(s) ignoré(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
