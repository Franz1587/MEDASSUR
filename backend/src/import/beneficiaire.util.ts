import type { PrismaService } from "../prisma/prisma.service";

// Bénéficiaire réel des soins (2026-11) — voir demande utilisateur : "il
// faut toujours faire remonter le nom de la personne qui a vraiment fait
// les soins". Les fichiers repris portent souvent le matricule du titulaire
// de la famille et, dans la colonne Bénéficiaire, le nom de l'ayant droit
// soigné : la ligne est rattachée au membre de la famille qui porte ce nom.

export interface MembreFamille { id: string; nom: string; prenom: string | null; contratId: string; familleId: string | null }

const mots = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().split(/[^A-Z0-9]+/).filter((m) => m.length > 1 && !["EPSE", "EPOUSE", "NEE", "VEUVE", "VVE"].includes(m));

// Part des mots du nom+prénom du membre présents dans le nom lu (0 à 1).
export function scoreNom(nomLu: string, m: { nom: string; prenom: string | null }): number {
  const lus = new Set(mots(nomLu));
  const siens = mots(`${m.nom} ${m.prenom ?? ""}`);
  return siens.length ? siens.filter((x) => lus.has(x)).length / siens.length : 0;
}

// Membres des familles des assurés donnés (une requête pour tout l'import).
export async function chargerFamilles(prisma: PrismaService, assures: { id: string; familleId: string | null }[]): Promise<Map<string, MembreFamille[]>> {
  const principaux = [...new Set(assures.map((a) => a.familleId ?? a.id))];
  const parFamille = new Map<string, MembreFamille[]>();
  if (!principaux.length) return parFamille;
  const membres = await prisma.assureSante.findMany({
    where: { OR: [{ id: { in: principaux } }, { familleId: { in: principaux } }] },
    select: { id: true, nom: true, prenom: true, contratId: true, familleId: true },
  });
  for (const m of membres) {
    const cle = m.familleId ?? m.id;
    const liste = parFamille.get(cle);
    if (liste) liste.push(m); else parFamille.set(cle, [m]);
  }
  return parFamille;
}

// Membre de la famille désigné par le nom lu ; l'assuré du matricule sinon
// (nom absent, déjà le bon, ou aucun membre clairement identifiable).
export function beneficiaireReel<T extends { id: string; familleId: string | null; nom: string; prenom: string | null }>(assure: T, nomLu: string | undefined, familles: Map<string, MembreFamille[]>): T | MembreFamille {
  if (!nomLu?.trim() || scoreNom(nomLu, assure) === 1) return assure;
  const membres = (familles.get(assure.familleId ?? assure.id) ?? []).filter((m) => m.id !== assure.id);
  // Le prénom doit figurer dans le nom lu : le nom de famille seul est commun à toute la famille.
  const lus = new Set(mots(nomLu));
  const notes = membres
    .filter((m) => mots(m.prenom ?? "").some((x) => lus.has(x)))
    .map((m) => ({ m, s: scoreNom(nomLu, m) })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s);
  if (!notes.length || (notes[1] && notes[1].s === notes[0].s)) return assure;
  return notes[0].s > scoreNom(nomLu, assure) ? notes[0].m : assure;
}
