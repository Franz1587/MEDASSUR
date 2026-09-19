import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";

// Génération du matricule assuré, avec préfixe propre à chaque société
// (2026-09) — voir demande utilisateur : "pour LA RUCHE EXCELLENCE on a :
// LRX-00000+une lettre majuscule. Le préfixe ici est LRX." Suffixe
// PUREMENT séquentiel (jamais un regroupement par famille, confirmé par
// l'utilisateur) : chaque personne — principale ou ayant droit — reçoit le
// prochain disponible. "L'application doit pouvoir lire les numéros
// existants... pour ne jamais le recréer" : jamais un compteur stocké à
// part, toujours dérivé du MAXIMUM réellement observé en base au moment de
// l'appel — même principe déjà éprouvé pour Contrat.numeroPolice/
// Compagnie.prefixeNumeroPolice (voir ContratsService.prochainNumeroPolice).
const MAX_NUMERO = 100_000; // 00000..99999 par lettre

function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// <numéro 5 chiffres><lettre A-Z> → un seul entier comparable, croissant
// dans l'ordre 00000A, 00001A, ..., 99999A, 00000B, ...
function parseSuffixe(matricule: string, prefixe: string): number | null {
  const m = matricule.match(new RegExp(`^${echapperRegex(prefixe)}-(\\d{5})([A-Z])$`));
  if (!m) return null;
  const numero = Number(m[1]);
  const lettreIndex = m[2].charCodeAt(0) - 65;
  return lettreIndex * MAX_NUMERO + numero;
}

function formaterSuffixe(combine: number, prefixe: string): string {
  const lettreIndex = Math.min(Math.floor(combine / MAX_NUMERO), 25);
  const numero = combine % MAX_NUMERO;
  const lettre = String.fromCharCode(65 + lettreIndex);
  return `${prefixe}-${String(numero).padStart(5, "0")}${lettre}`;
}

// Crée un GÉNÉRATEUR (une seule lecture de la base, puis un curseur en
// mémoire) plutôt qu'une fonction qui rescanne la base à chaque appel —
// indispensable dès qu'un appelant crée PLUSIEURS assurés dans le MÊME
// lot avant de les enregistrer (ex. SanteService.importPopulation, qui
// construit tout le lot en mémoire puis l'insère en une seule transaction
// à la fin) : rescanner la base à chaque ligne verrait toujours le même
// "dernier matricule" (rien n'est encore committé) et produirait des
// doublons — exactement ce que l'utilisateur a explicitement demandé
// d'éviter. Un seul générateur, créé une fois avant la boucle d'ajout,
// couvre aussi bien un seul assuré (MouvementsService.appliquerMouvement)
// qu'un lot entier.
export async function creerGenerateurMatricule(prisma: PrismaService): Promise<() => string> {
  const societeId = TenantContext.getSocieteId() ?? "default";
  const parametres = await prisma.parametresEntreprise.findUnique({ where: { id: societeId }, select: { prefixeMatricule: true } });
  const prefixe = parametres?.prefixeMatricule?.trim();

  // Aucun préfixe configuré → comportement HISTORIQUE inchangé, aucune
  // régression pour les sociétés qui n'ont rien configuré (societe-
  // bootstrap y compris, tant qu'elle n'a pas son propre préfixe).
  if (!prefixe) {
    return () => `MAT-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  // AssureSante est cloisonné par le middleware Prisma (TENANT_MODELS) —
  // ce findMany ne remonte déjà que les assurés de CETTE société, jamais
  // besoin de repasser societeId à la main.
  const existants = await prisma.assureSante.findMany({
    where: { matricule: { startsWith: `${prefixe}-` } },
    select: { matricule: true },
  });

  let curseur = -1;
  for (const e of existants) {
    const combine = parseSuffixe(e.matricule, prefixe);
    if (combine !== null && combine > curseur) curseur = combine;
  }

  return () => {
    curseur += 1;
    return formaterSuffixe(curseur, prefixe);
  };
}
