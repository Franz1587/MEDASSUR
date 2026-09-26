import { Prisma, PrismaClient } from "@prisma/client";

// Identité d'une personne assurée AU SEIN D'UNE SOCIÉTÉ (2026-09) — voir
// schema.prisma IdentiteAssuree. Règles données par l'utilisateur :
//
//  - "le même nom, même prénom, même date de naissance, c'est forcément la
//    même personne" — en plus du matricule (ancien ou actuel)...
//  - ... mais uniquement DANS LA MÊME SOCIÉTÉ : "Chaque société gère ses
//    données. En aucun moment l'application ne doit mélanger les données...
//    on peut se trouver avec des sociétés ayant géré les mêmes souscripteurs
//    à des dates différentes, mais en aucun moment l'application doit les
//    considérer comme étant les mêmes données ou les données se rapportant à
//    la même personne."
//
// Toutes les recherches sont donc explicitement filtrées sur la société du
// contrat (en plus du cloisonnement automatique du middleware Prisma, qui
// ne s'applique pas à la requête SQL brute ci-dessous).

type Prisme = PrismaClient | Prisma.TransactionClient;

const ACCENTS = "ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝŸ";
const SANS_ACCENTS = "AAAAAACEEEEIIIINOOOOOUUUUYY";

function cleTexte(v: string | null | undefined): string {
  return (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// Identité d'une personne dans la société `societeId` : par matricule
// (actuel ou ancien), sinon par nom + prénom + date de naissance identiques,
// sinon nouvelle identité. Le matricule devient le matricule ACTUEL de
// l'identité retenue.
export async function resoudreIdentite(
  prisma: Prisme,
  societeId: string | null,
  p: { matricule: string; nom: string; prenom?: string | null; dateNaissance?: string | null },
): Promise<{ id: string }> {
  const matricule = p.matricule.trim();
  const alias = await prisma.matriculeAssuree.findFirst({ where: { societeId, matricule }, select: { id: true, identiteId: true } });
  let identiteId = alias?.identiteId
    ?? (await prisma.identiteAssuree.findFirst({ where: { societeId, matricule }, select: { id: true } }))?.id
    ?? null;

  if (!identiteId && p.dateNaissance?.trim()) {
    // Même normalisation qu'en JS (cleTexte) : majuscules, sans accents,
    // espaces réduits — "Élodie  Nzé" = "ELODIE NZE".
    const [trouvee] = await prisma.$queryRaw<{ identiteId: string }[]>`
      SELECT "identiteId" FROM "AssureSante"
      WHERE "identiteId" IS NOT NULL
        AND "societeId" IS NOT DISTINCT FROM ${societeId}
        AND trim("dateNaissance") = ${p.dateNaissance.trim()}
        AND regexp_replace(translate(upper(trim(nom)), ${ACCENTS}, ${SANS_ACCENTS}), '\\s+', ' ', 'g') = ${cleTexte(p.nom)}
        AND regexp_replace(translate(upper(coalesce(trim(prenom), '')), ${ACCENTS}, ${SANS_ACCENTS}), '\\s+', ' ', 'g') = ${cleTexte(p.prenom)}
      LIMIT 1`;
    identiteId = trouvee?.identiteId ?? null;
  }

  if (!identiteId) {
    const creee = await prisma.identiteAssuree.create({ data: { societeId, matricule, nom: p.nom, prenom: p.prenom ?? null }, select: { id: true } });
    identiteId = creee.id;
  }
  // findFirst + create/update plutôt qu'upsert : l'upsert sur une clé unique
  // composite (societeId, matricule) ne passe pas le middleware de
  // cloisonnement (voir mémoire project-tenant-middleware-findunique-bug).
  if (alias) {
    if (alias.identiteId !== identiteId) await prisma.matriculeAssuree.update({ where: { id: alias.id }, data: { identiteId, statut: "Actuel" } });
  } else {
    await prisma.matriculeAssuree.create({ data: { societeId, matricule, identiteId, statut: "Actuel" } });
  }
  return { id: identiteId };
}
