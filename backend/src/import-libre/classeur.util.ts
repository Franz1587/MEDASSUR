import * as XLSX from "xlsx";

// Lecture déterministe d'un classeur Excel MULTI-FEUILLES (2026-11) — voir
// demande utilisateur : « Ariana doit pouvoir lire les classeurs avec
// multifeuilles ». Le chemin habituel de l'import libre passe par Claude avec
// un contenu tronqué (3 feuilles, 600 lignes) : impossible pour 6 800
// participants. Ici, chaque feuille est lue en entier, son rôle (participants
// ou contrats) est reconnu à ses en-têtes, sans appel externe.

export interface FeuilleLue {
  nom: string;
  entetes: string[];
  lignes: string[][];
}

export const normaliserCle = (s: unknown): string =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const MOTS_ENTETE = /contrat|police|matricule|prenom|nom|statut|produit|souscripteur|tel|assure|participant|etat/;

export function lireClasseur(buffer: Buffer): FeuilleLue[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const feuilles: FeuilleLue[] = [];
  for (const nom of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, defval: "", raw: false, blankrows: false });
    const texte = (r: unknown[]) => r.map((c) => String(c ?? "").trim());
    // L'en-tête est la première ligne qui ressemble à des titres de colonnes (titres de page tolérés au-dessus).
    const idx = rows.slice(0, 15).findIndex((r) => {
      const cellules = texte(r).filter(Boolean);
      return cellules.length >= 2 && cellules.filter((c) => MOTS_ENTETE.test(normaliserCle(c))).length >= 2;
    });
    if (idx < 0) continue;
    feuilles.push({
      nom,
      entetes: texte(rows[idx]),
      lignes: rows.slice(idx + 1).map(texte).filter((r) => r.some(Boolean)),
    });
  }
  return feuilles;
}

export interface ColonnesClasseur {
  police: number; matricule: number; telephone: number; prenom: number; nom: number;
  souscripteur: number; produit: number; statut: number;
}

export function reconnaitreColonnes(entetes: string[]): ColonnesClasseur {
  const cles = entetes.map(normaliserCle);
  const trouver = (...tests: RegExp[]) => {
    for (const t of tests) { const i = cles.findIndex((c) => c && t.test(c)); if (i >= 0) return i; }
    return -1;
  };
  return {
    police: trouver(/^n ?contrat$/, /^(numero|n) ?(de )?(contrat|police)/, /^(contrat|police)$/, /(contrat|police)/),
    matricule: trouver(/matricule/),
    telephone: trouver(/^tel/, /telephone|mobile|portable|contact/),
    prenom: trouver(/prenom/),
    nom: trouver(/^nom$/, /^nom( |$)/),
    souscripteur: trouver(/souscripteur/, /^(client|societe|entreprise)$/),
    produit: trouver(/produit/),
    statut: trouver(/^statut/, /statut|etat|situation/),
  };
}

export interface RolesClasseur {
  participants?: { feuille: FeuilleLue; col: ColonnesClasseur };
  contrats?: { feuille: FeuilleLue; col: ColonnesClasseur };
  ignorees: string[];
}

// Une feuille « participants » porte un numéro de contrat ET un matricule ; une
// feuille « contrats » porte un numéro de contrat et un produit/souscripteur
// sans matricule (synthèse par contrat).
export function detecterRoles(feuilles: FeuilleLue[]): RolesClasseur {
  const roles: RolesClasseur = { ignorees: [] };
  for (const f of feuilles) {
    const col = reconnaitreColonnes(f.entetes);
    if (col.police >= 0 && col.matricule >= 0 && !roles.participants) roles.participants = { feuille: f, col };
    else if (col.police >= 0 && col.matricule < 0 && (col.produit >= 0 || col.souscripteur >= 0) && !roles.contrats) roles.contrats = { feuille: f, col };
    else roles.ignorees.push(f.nom);
  }
  return roles;
}

// Statut du fichier → vocabulaire réel de AssureSante.statut (Actif | Suspendu ;
// « Radié » est une sortie définitive tracée, jamais déduite d'un fichier).
// Même règle que SanteService.normaliserStatutImport : « Terminé »/« Inactif »
// = Suspendu ; valeur inconnue = aucun changement.
export function statutDepuisFichier(valeur: string): "Actif" | "Suspendu" | undefined {
  const v = normaliserCle(valeur).replace(/ /g, "");
  if (["actif", "active", "actifve"].includes(v)) return "Actif";
  if (["termine", "terminee", "inactif", "inactive", "suspendu", "suspendue", "resilie", "resiliee", "expire", "expiree"].includes(v)) return "Suspendu";
  return undefined;
}

export const clePolice = (s: string): string => s.trim().replace(/\s+/g, "").toUpperCase();

// Deux noms de souscripteur désignent la même entité s'ils sont identiques, si l'un contient
// l'autre (« ANINF » / « Agence nationale… (ANINF) ») ou s'ils partagent leur sigle entre parenthèses.
export function memeSouscripteur(a: string, b: string): boolean {
  const x = normaliserCle(a), y = normaliserCle(b);
  if (!x || !y) return true;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const sigle = (s: string) => (s.match(/\(([^)]+)\)/)?.[1] ?? "").trim();
  const compact = (s: string) => normaliserCle(s).replace(/ /g, "");
  const sx = compact(sigle(a)), sy = compact(sigle(b));
  if (sx && sy && sx === sy) return true; // « S.B.L » / « SBL »
  return Boolean((sx && (sx === compact(b) || compact(b).includes(sx))) || (sy && (sy === compact(a) || compact(a).includes(sy))));
}
