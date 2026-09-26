import { Prisma, PrismaClient } from "@prisma/client";

// Identité transverse d'une personne assurée (2026-09) — voir schema.prisma
// IdentiteAssuree. Deux règles métier données par l'utilisateur :
//
//  1. "le même nom, même prénom, même date de naissance, c'est forcément la
//     même personne" — en plus du matricule (ancien ou actuel), et quelle
//     que soit la société qui l'assure.
//  2. "il ne peut pas être actif sur les deux sociétés sauf si c'est un
//     ayant droit. mais un assuré non... vérifier la date d'effet du contrat
//     car la date la plus récente est donc la date qui indique le contrat
//     sur lequel il doit rester actif."
//
// IdentiteAssuree/MatriculeAssuree ne sont pas cloisonnées par société ;
// AssureSante l'est (middleware Prisma) : les recherches qui doivent voir
// les AUTRES sociétés passent donc par des requêtes SQL paramétrées.

type Prisme = PrismaClient | Prisma.TransactionClient;

const ACCENTS = "ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸ";
const SANS_ACCENTS = "AAAAAACEEEEIIIINOOOOOUUUUYY";

function cleTexte(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.trim().split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Identité d'une personne : par matricule (actuel ou ancien) d'abord, sinon
// par nom + prénom + date de naissance identiques (toutes sociétés), sinon
// nouvelle identité. Le matricule est toujours enregistré comme matricule
// ACTUEL de l'identité retenue.
export async function resoudreIdentite(
  prisma: Prisme,
  p: { matricule: string; nom: string; prenom?: string | null; dateNaissance?: string | null },
): Promise<{ id: string }> {
  const matricule = p.matricule.trim();
  const parMatricule = await prisma.matriculeAssuree.findUnique({ where: { matricule }, select: { identiteId: true } })
    ?? (await prisma.identiteAssuree.findUnique({ where: { matricule }, select: { id: true } }).then((i) => (i ? { identiteId: i.id } : null)));
  let identiteId = parMatricule?.identiteId ?? null;

  if (!identiteId && p.dateNaissance?.trim()) {
    // Même normalisation qu'en JS (cleTexte) : majuscules, sans accents,
    // espaces réduits — "Élodie  Nzé" = "ELODIE NZE".
    const [trouvee] = await prisma.$queryRaw<{ identiteId: string }[]>`
      SELECT "identiteId" FROM "AssureSante"
      WHERE "identiteId" IS NOT NULL
        AND trim("dateNaissance") = ${p.dateNaissance.trim()}
        AND regexp_replace(translate(upper(trim(nom)), ${ACCENTS}, ${SANS_ACCENTS}), '\\s+', ' ', 'g') = ${cleTexte(p.nom)}
        AND regexp_replace(translate(upper(coalesce(trim(prenom), '')), ${ACCENTS}, ${SANS_ACCENTS}), '\\s+', ' ', 'g') = ${cleTexte(p.prenom)}
      LIMIT 1`;
    identiteId = trouvee?.identiteId ?? null;
  }

  if (!identiteId) {
    const creee = await prisma.identiteAssuree.create({ data: { matricule, nom: p.nom, prenom: p.prenom ?? null }, select: { id: true } });
    identiteId = creee.id;
  }
  await prisma.matriculeAssuree.upsert({
    where: { matricule },
    update: { identiteId, statut: "Actuel" },
    create: { matricule, identiteId, statut: "Actuel" },
  });
  return { id: identiteId };
}

// Règle 2 — un ASSURÉ PRINCIPAL n'est actif que dans UNE société. Pour
// chaque affiliation donnée (assuré principal, Actif), compare la date
// d'effet de son contrat à celle des affiliations actives de la même
// personne dans les AUTRES sociétés : la plus récente reste active, les
// autres passent en Suspendu (jamais Radié : réversible, aucune sortie
// définitive décidée à la place de l'autre société). À date égale,
// l'affiliation déjà en place est conservée. Les ayants droit ne sont
// jamais concernés.
export async function appliquerActifUniqueInterSocietes(prisma: Prisme, affiliationIds: string[]): Promise<string[]> {
  if (affiliationIds.length === 0) return [];
  const messages: string[] = [];
  const cibles = await prisma.$queryRaw<{ id: string; identiteId: string; societeId: string | null; nom: string; prenom: string | null; dateDebut: string }[]>`
    SELECT a.id, a."identiteId", a."societeId", a.nom, a.prenom, c."dateDebut"
    FROM "AssureSante" a JOIN "Contrat" c ON c.id = a."contratId"
    WHERE a.id IN (${Prisma.join(affiliationIds)}) AND a."identiteId" IS NOT NULL
      AND a."familleId" IS NULL AND a.statut = 'Actif'`;
  for (const cible of cibles) {
    const autres = await prisma.$queryRaw<{ id: string; dateDebut: string; numeroPolice: string | null }[]>`
      SELECT a.id, c."dateDebut", c."numeroPolice"
      FROM "AssureSante" a JOIN "Contrat" c ON c.id = a."contratId"
      WHERE a."identiteId" = ${cible.identiteId} AND a.id <> ${cible.id}
        AND a."familleId" IS NULL AND a.statut = 'Actif'
        AND a."societeId" IS DISTINCT FROM ${cible.societeId}`;
    if (autres.length === 0) continue;
    const dateCible = parseDateFr(cible.dateDebut)?.getTime() ?? 0;
    const plusRecenteAutre = Math.max(...autres.map((a) => parseDateFr(a.dateDebut)?.getTime() ?? 0));
    const nom = `${cible.nom}${cible.prenom ? " " + cible.prenom : ""}`;
    if (dateCible > plusRecenteAutre) {
      await prisma.$executeRaw`UPDATE "AssureSante" SET statut = 'Suspendu' WHERE id IN (${Prisma.join(autres.map((a) => a.id))})`;
      messages.push(`${nom} : contrat le plus récent (effet ${cible.dateDebut}) — son affiliation d'assuré principal dans une autre société a été suspendue.`);
    } else {
      await prisma.$executeRaw`UPDATE "AssureSante" SET statut = 'Suspendu' WHERE id = ${cible.id}`;
      messages.push(`${nom} : déjà assuré principal actif dans une autre société sur un contrat plus récent ou de même date d'effet — importé en Suspendu ici.`);
    }
  }
  return messages;
}
