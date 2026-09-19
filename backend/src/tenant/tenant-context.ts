import { AsyncLocalStorage } from "node:async_hooks";

// Contexte multi-tenant courant (2026-09, Phase 2) — voir SocieteAssurance /
// User.societeId. Porte le societeId de l'utilisateur connecté à travers
// toute la chaîne d'appel d'une requête HTTP (contrôleur → service → Prisma)
// SANS avoir à modifier la signature de chaque méthode de service — voir
// TenantContextInterceptor (qui alimente ce contexte à chaque requête) et
// PrismaService (qui le consulte pour filtrer/injecter societeId
// automatiquement sur les modèles cloisonnés).
//
// societeId = null signifie "pas de cloisonnement" — soit un super_admin
// (au-dessus de toute société, voir demande utilisateur : "il a la main sur
// toutes les fonctionnalités... et peut y accéder en assistance"), soit
// l'absence de requête HTTP en cours (scripts ponctuels, seed, tests) : dans
// les deux cas, aucun filtrage n'est appliqué — jamais une exception.
interface TenantStore {
  societeId: string | null;
}

const als = new AsyncLocalStorage<TenantStore>();

export const TenantContext = {
  run<T>(societeId: string | null, fn: () => T): T {
    return als.run({ societeId }, fn);
  },

  getSocieteId(): string | null {
    return als.getStore()?.societeId ?? null;
  },
};
