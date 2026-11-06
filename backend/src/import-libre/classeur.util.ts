import * as XLSX from "xlsx";

// Lecture déterministe d'un classeur Excel MULTI-FEUILLES (2026-11) — voir
// demande utilisateur : « Ariana doit pouvoir lire les classeurs avec
// multifeuilles » puis « mieux apprécier et analyser les données de chaque
// feuille, peu importe ce qui s'y trouve, en comparant avec la base ». Le
// chemin habituel de l'import libre passe par Claude avec un contenu tronqué :
// impossible pour 19 000 personnes. Ici, chaque feuille est lue en entier, son
// rôle est reconnu à ses en-têtes ET à son contenu, sans appel externe.

export interface FeuilleLue {
  nom: string;
  entetes: string[];
  lignes: string[][];
}

export const normaliserCle = (s: unknown): string =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const MOTS_ENTETE = /contrat|police|matricule|prenom|nom|statut|produit|souscripteur|tel|assure|participant|etat|type|naissance|sexe/;

export function lireClasseur(buffer: Buffer): FeuilleLue[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const feuilles: FeuilleLue[] = [];
  for (const nom of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, defval: "", raw: false, blankrows: false });
    const texte = (r: unknown[]) => r.map((c) => String(c ?? "").trim());
    // L'en-tête est la première ligne qui ressemble à des titres de colonnes (titres de page tolérés au-dessus).
    let idx = rows.slice(0, 15).findIndex((r) => {
      const cellules = texte(r).filter(Boolean);
      return cellules.length >= 2 && cellules.filter((c) => MOTS_ENTETE.test(normaliserCle(c))).length >= 2;
    });
    // Feuille aux titres inconnus : la première ligne fait office d'en-tête, la feuille est analysée quand même.
    if (idx < 0) idx = rows.findIndex((r) => texte(r).filter(Boolean).length >= 2);
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
  souscripteur: number; produit: number;
  statut: number;          // statut de la PERSONNE (ou statut unique du fichier)
  statutContrat: number;
  type: number; dateNaissance: number; sexe: number;
  dateDebut: number; dateFin: number; nbPersonnes: number;
  motif: number;           // « Point à vérifier », remarque, commentaire…
  supprime: number; conserve: number;
}

export function reconnaitreColonnes(entetes: string[]): ColonnesClasseur {
  const cles = entetes.map(normaliserCle);
  const trouver = (...tests: RegExp[]) => {
    for (const t of tests) { const i = cles.findIndex((c) => c && t.test(c)); if (i >= 0) return i; }
    return -1;
  };
  const statutContrat = trouver(/statut.*contrat|etat.*contrat/);
  const statutPersonne = trouver(/statut.*(personne|assure|participant|beneficiaire)/, /^statut$/);
  const statutLibre = statutPersonne >= 0 ? statutPersonne : cles.findIndex((c, i) => i !== statutContrat && /statut|etat|situation/.test(c));
  return {
    police: trouver(/^n ?contrat$/, /^(numero|n) ?(de )?(contrat|police)/, /^(contrat|police)$/, /(contrat|police)/),
    matricule: trouver(/^matricule$/, /^matricule( |$)/, /matricule/),
    telephone: trouver(/^tel/, /telephone|mobile|portable|contact/),
    prenom: trouver(/prenom/),
    nom: trouver(/^nom$/, /^nom( |$)/),
    souscripteur: trouver(/souscripteur/, /^(client|societe|entreprise)$/),
    produit: trouver(/produit/),
    statut: statutLibre,
    statutContrat,
    type: trouver(/^type$/, /^(type|qualite|lien|affiliation)( |$)/),
    dateNaissance: trouver(/naissance/, /^(ne|nee)( |$)/, /^dob$/),
    sexe: trouver(/^sexe$/, /^(sexe|genre)/),
    dateDebut: trouver(/date debut|debut|effet/),
    dateFin: trouver(/date fin|echeance|^fin$/),
    nbPersonnes: trouver(/total (personnes|participants|assures)/, /(nb|nombre).*(particip|assure|personne)/),
    motif: trouver(/point.*verifier|a verifier|remarque|commentaire|observation|motif|anomalie/),
    supprime: trouver(/supprim/),
    conserve: trouver(/conserv/),
  };
}

export type RoleFeuille = "participants" | "contrats" | "anomalies" | "doublons" | "remarques" | "autre";

export interface FeuilleReconnue { feuille: FeuilleLue; col: ColonnesClasseur; role: RoleFeuille }

export interface RolesClasseur {
  participants?: FeuilleReconnue;
  contrats?: FeuilleReconnue;
  anomalies: FeuilleReconnue[];
  doublons: FeuilleReconnue[];
  remarques: FeuilleReconnue[];
  autres: FeuilleReconnue[];
  toutes: FeuilleReconnue[];
}

// Rôle d'une feuille d'après ses colonnes :
//  - doublons    : une colonne « supprimé » et une colonne « conservé » (anciens/nouveaux matricules) ;
//  - anomalies   : matricule + colonne « point à vérifier » (liste de contrôle laissée par la source) ;
//  - participants: N° de contrat + matricule (la plus grande feuille de ce type) ;
//  - contrats    : N° de contrat sans matricule, avec produit/souscripteur/dates/statut contrat ;
//  - remarques   : N° de contrat + remarque, sans matricule ni produit.
export function detecterRoles(feuilles: FeuilleLue[]): RolesClasseur {
  const roles: RolesClasseur = { anomalies: [], doublons: [], remarques: [], autres: [], toutes: [] };
  const candidates: FeuilleReconnue[] = [];
  for (const feuille of feuilles) {
    const col = reconnaitreColonnes(feuille.entetes);
    let role: RoleFeuille = "autre";
    if (col.supprime >= 0 && col.conserve >= 0) role = "doublons";
    else if (col.matricule >= 0 && col.motif >= 0 && col.police >= 0) role = "anomalies";
    else if (col.police >= 0 && col.matricule >= 0) role = "participants";
    else if (col.police >= 0 && col.motif >= 0) role = "remarques";
    else if (col.police >= 0 && (col.produit >= 0 || col.souscripteur >= 0 || col.dateDebut >= 0 || col.statutContrat >= 0)) role = "contrats";
    const f: FeuilleReconnue = { feuille, col, role };
    roles.toutes.push(f);
    if (role === "participants") candidates.push(f);
  }
  const principale = candidates.sort((a, b) => b.feuille.lignes.length - a.feuille.lignes.length)[0];
  for (const f of roles.toutes) {
    if (f.role === "participants" && f !== principale) f.role = "autre";
    if (f.role === "participants") roles.participants = f;
    else if (f.role === "contrats" && !roles.contrats) roles.contrats = f;
    else if (f.role === "contrats") f.role = "autre";
    if (f.role === "anomalies") roles.anomalies.push(f);
    else if (f.role === "doublons") roles.doublons.push(f);
    else if (f.role === "remarques") roles.remarques.push(f);
    else if (f.role === "autre") roles.autres.push(f);
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

// Statut de contrat du fichier comparé à celui de l'application (« Terminé » couvre Résilié et Expiré).
export function statutContratEquivalent(fichier: string, base: string): boolean {
  const f = statutDepuisFichier(fichier);
  if (!f) return true;
  const actifBase = base === "Actif" || base === "En renouvellement";
  return f === "Actif" ? actifBase : !actifBase;
}

export type TypeAssure = "AS" | "CJ" | "EF";
export function typeAssureDepuisFichier(valeur: string): TypeAssure | undefined {
  const v = normaliserCle(valeur).replace(/ /g, "");
  if (["as", "ap", "assure", "assureprincipal", "principal", "titulaire", "adherent"].includes(v)) return "AS";
  if (["cj", "conjoint", "conjointe", "epoux", "epouse"].includes(v)) return "CJ";
  if (["ef", "enfant", "enfants"].includes(v)) return "EF";
  return undefined;
}

export function sexeDepuisFichier(valeur: string): "M" | "F" | undefined {
  const v = normaliserCle(valeur).replace(/ /g, "");
  if (["m", "h", "masculin", "homme"].includes(v)) return "M";
  if (["f", "feminin", "femme"].includes(v)) return "F";
  return undefined;
}

export const clePolice = (s: string): string => s.trim().replace(/\s+/g, "").toUpperCase();

// Jour et mois permutés (05/06/1975 ↔ 06/05/1975) : l'écart de date de naissance le plus fréquent.
export function dateInversee(a: string, b: string): boolean {
  const [ja, ma, aa] = a.split("/"), [jb, mb, ab] = b.split("/");
  return Boolean(aa && ab && aa === ab && ja === mb && ma === jb && ja !== ma);
}

// Mots significatifs d'un nom, comparés sans accent ni ordre (« NOM Prénom » = « Prénom NOM »).
export const motsNom = (...parties: (string | null | undefined)[]): Set<string> =>
  new Set(normaliserCle(parties.filter(Boolean).join(" ")).split(" ").filter((m) => m.length > 1));

export function nomsCompatibles(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return true;
  for (const m of a) if (b.has(m)) return true;
  return false;
}

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
