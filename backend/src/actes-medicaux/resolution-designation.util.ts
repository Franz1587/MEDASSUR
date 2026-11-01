import type { PrismaService } from "../prisma/prisma.service";
import { normaliserRubrique } from "./rubrique-contrat.util";

// Reprise d'antériorité (2026-11) — voir demande utilisateur : "dans la
// colonne Désignation [il y a] le vrai acte qui a été fait... le but de la
// récupération des données est d'avoir à 100% la même information qui est
// sur l'ancien système". La désignation n'est plus jamais remplacée par le
// repère "Prestation non détaillée" : elle est rattachée à l'acte du
// catalogue de même libellé, sinon l'acte est créé avec le libellé exact.
export const FAMILLE_REPRISE = "ACTES REPRIS (ANCIEN SYSTÈME)";

// Rubriques portées par ActeMedical.categorieGarantie (statistiques par rubrique).
export const RUBRIQUES_ACTES = [
  "Consultations", "Actes de Spécialités", "Analyses Médicale", "Imagerie", "Pharmacie", "Hospitalisation",
  "Petite Chirurgie/Soins", "Soins & Prothèses dentaires", "Optique", "Maternité", "Kinésithérapie & Cure thermale",
] as const;

// Classement d'une liste de désignations inconnues : texte → rubrique (ARIANA).
export type ClasseurDesignations = (textes: string[]) => Promise<Map<string, string>>;

export const cleDesignation = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9%+]+/g, " ").trim();

// Repli sans ARIANA : rubrique déduite du type de prestation de la ligne.
function rubriqueParDefaut(typePrestation: string): string | null {
  const r = normaliserRubrique(typePrestation);
  return (RUBRIQUES_ACTES as readonly string[]).includes(r) ? r : null;
}

// Une requête pour tout le catalogue, une création par désignation inconnue
// (jamais par ligne) : `designations` = texte d'origine → type de prestation.
export async function resoudreDesignations(prisma: PrismaService, designations: Map<string, string>, classer?: ClasseurDesignations): Promise<Map<string, string>> {
  const resultat = new Map<string, string>();
  if (designations.size === 0) return resultat;
  const parCle = new Map<string, string>();
  for (const a of await prisma.acteMedical.findMany({ select: { id: true, libelle: true } })) {
    const cle = cleDesignation(a.libelle);
    if (cle && !parCle.has(cle)) parCle.set(cle, a.id);
  }
  const inconnues = [...designations.keys()].filter((t) => cleDesignation(t) && !parCle.has(cleDesignation(t)));
  const classees = inconnues.length && classer ? await classer(inconnues).catch(() => new Map<string, string>()) : new Map<string, string>();
  for (const [texte, typePrestation] of designations) {
    const cle = cleDesignation(texte);
    if (!cle) continue;
    let id = parCle.get(cle);
    if (!id) {
      const rubrique = classees.get(texte);
      id = (await prisma.acteMedical.create({
        data: {
          libelle: texte.trim().replace(/\s+/g, " "), famille: FAMILLE_REPRISE, prixDefaut: 0,
          categorieGarantie: rubrique && (RUBRIQUES_ACTES as readonly string[]).includes(rubrique) ? rubrique : rubriqueParDefaut(typePrestation),
        },
        select: { id: true },
      })).id;
      parCle.set(cle, id);
    }
    resultat.set(texte, id);
  }
  return resultat;
}
