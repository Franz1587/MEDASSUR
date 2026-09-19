import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { TenantContext } from "../tenant/tenant-context";
import { TENANT_MODELS } from "../tenant/tenant-models";

// Actions Prisma qui acceptent un `where` filtrable directement.
const READ_ACTIONS = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);
// findUnique(OrThrow) n'accepte QUE des champs uniques dans `where` — on les
// convertit en équivalent findFirst pour pouvoir y ajouter societeId sans
// casser la requête (motif classique des middlewares Prisma multi-tenant).
const UNIQUE_READ_ACTIONS: Record<string, Prisma.PrismaAction> = {
  findUnique: "findFirst",
  findUniqueOrThrow: "findFirstOrThrow",
};
const WHERE_WRITE_ACTIONS = new Set(["update", "updateMany", "delete", "deleteMany"]);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    this.registerTenantScoping();
  }

  // Cloisonnement automatique par société (2026-09, Phase 2 multi-tenant) —
  // voir demande utilisateur : "isolation complète par société". Plutôt que
  // de modifier chaque service métier (des dizaines de fichiers, findMany/
  // create dispersés partout), un seul middleware Prisma ($use, disponible
  // en 5.22 — voir package.json) intercepte CHAQUE requête sur un modèle
  // cloisonné (voir tenant-models.ts) et :
  //   - lecture (findMany/findFirst/count/aggregate/groupBy) → ajoute
  //     `where.societeId` ;
  //   - findUnique(OrThrow) → converti en findFirst(OrThrow) équivalent
  //     (seul moyen d'ajouter societeId, un findUnique n'acceptant que des
  //     champs uniques dans son `where`) ;
  //   - écriture avec `where` (update/updateMany/delete/deleteMany) →
  //     ajoute societeId au `where`, en défense en profondeur (empêche de
  //     modifier/supprimer une ligne d'une autre société même via un id
  //     deviné) ;
  //   - create/createMany/upsert → injecte societeId dans `data` (create)
  //     si absent, sans jamais écraser une valeur déjà fournie explicitement
  //     (utile pour les scripts d'administration/migration).
  // societeId vient de TenantContext (AsyncLocalStorage, alimenté par
  // TenantContextInterceptor à chaque requête HTTP) : null = super_admin ou
  // contexte hors requête (script, seed) → AUCUN filtrage, comportement
  // historique préservé à l'identique.
  //
  // Limite connue : ne descend PAS dans les écritures imbriquées (ex.
  // `create: { data: { ..., garanties: { create: [...] } } }` sur un modèle
  // NON cloisonné imbriqué dans un modèle cloisonné) — seul le niveau
  // racine de chaque appel Prisma est scopé. Suffisant pour l'isolation des
  // données métier (chaque écran interroge son propre modèle racine), à
  // revisiter si un futur modèle imbriqué cloisonné l'exige.
  private registerTenantScoping() {
    this.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
      const model = params.model;
      if (!model || !TENANT_MODELS.has(model)) return next(params);

      const societeId = TenantContext.getSocieteId();
      if (!societeId) return next(params);

      params.args = params.args ?? {};

      const uniqueEquivalent = UNIQUE_READ_ACTIONS[params.action];
      if (uniqueEquivalent) {
        params.action = uniqueEquivalent;
        // findUnique accepte, en plus des champs simples (id: "..."),
        // l'objet composite généré par un `@@unique([a, b])` (ex.
        // `factureId_assureId: { factureId, assureId }`) — un wrapper qui
        // n'existe QUE dans WhereUniqueInput. findFirst (l'action de repli
        // ci-dessus) ne connaît que WhereInput, où ce wrapper n'existe pas
        // ("Unknown argument factureId_assureId") : on l'aplatit donc en
        // ses champs internes avant d'y ajouter societeId. Bug réel trouvé
        // en production (2026-09-12) — DocumentsService.obtenirOuCreerDecompte
        // (Decompte.factureId_assureId) échouait sur CHAQUE génération de
        // décompte dès qu'un contexte société était actif, symptôme du
        // signalement utilisateur "les documents... ne remontent plus".
        const flatWhere: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(params.args.where ?? {})) {
          if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
            Object.assign(flatWhere, value as Record<string, unknown>);
          } else {
            flatWhere[key] = value;
          }
        }
        params.args.where = { ...flatWhere, societeId };
        return next(params);
      }

      if (READ_ACTIONS.has(params.action)) {
        params.args.where = { ...params.args.where, societeId };
        return next(params);
      }

      if (WHERE_WRITE_ACTIONS.has(params.action)) {
        params.args.where = { ...params.args.where, societeId };
        return next(params);
      }

      if (params.action === "upsert") {
        params.args.where = { ...params.args.where, societeId };
        params.args.create = { societeId, ...params.args.create };
        return next(params);
      }

      if (params.action === "create") {
        params.args.data = { societeId, ...params.args.data };
        return next(params);
      }

      if (params.action === "createMany" && Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((d: Record<string, unknown>) => ({ societeId, ...d }));
        return next(params);
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
