import { ForbiddenException, Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { TenantContext } from "../tenant/tenant-context";
import { TENANT_MODELS, TENANT_WRITE_SCOPED_MODELS } from "../tenant/tenant-models";

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

const NESTED_WRITE_OPS = ["create", "createMany", "connectOrCreate", "upsert", "update", "updateMany", "data"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Object.getPrototypeOf(v) === Object.prototype;
}

// Écritures imbriquées : on ne peut pas y injecter societeId (le modèle
// imbriqué n'en a pas forcément), mais toute valeur fournie est écrasée.
function forceNestedSociete(node: unknown, societeId: string): void {
  if (Array.isArray(node)) {
    for (const n of node) forceNestedSociete(n, societeId);
    return;
  }
  if (!isPlainObject(node)) return;
  if ("societeId" in node) node.societeId = societeId;
  for (const value of Object.values(node)) {
    if (!isPlainObject(value)) continue;
    for (const op of NESTED_WRITE_OPS) {
      if (op in value) forceNestedSociete(value[op], societeId);
    }
  }
}

// Anti mass-assignment : retire societeId / la relation `societe` fournis par
// l'appelant au niveau racine (le middleware réinjecte la valeur du contexte)
// et force societeId dans les écritures imbriquées.
function sanitizeRoot(data: unknown, societeId: string): Record<string, unknown> {
  if (!isPlainObject(data)) return {};
  const clean: Record<string, unknown> = { ...data };
  delete clean.societeId;
  delete clean.societe;
  forceNestedSociete(clean, societeId);
  return clean;
}

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
  //   - create/createMany/upsert → injecte TOUJOURS societeId (celui du
  //     contexte) dans `data`, en écartant toute valeur fournie par le client
  //     (anti mass-assignment) ; update/updateMany retirent aussi societeId
  //     de `data` pour empêcher un transfert vers une autre société. Les
  //     écritures imbriquées voient leur societeId éventuel écrasé.
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
      if (model && TENANT_WRITE_SCOPED_MODELS.has(model)) return this.scopeWritesOnly(params, next);
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
        // Anti mass-assignment : un client ne doit jamais pouvoir déplacer une
        // ligne vers une autre société en envoyant societeId dans `data`.
        if (params.args.data !== undefined) params.args.data = sanitizeRoot(params.args.data, societeId);
        return next(params);
      }

      if (params.action === "upsert") {
        params.args.where = { ...params.args.where, societeId };
        params.args.create =         { ...sanitizeRoot(params.args.create, societeId), societeId };
                params.args.update = sanitizeRoot(params.args.update, societeId);
        return next(params);
      }

      if (params.action === "create") {
        params.args.data = { ...sanitizeRoot(params.args.data, societeId), societeId };
        return next(params);
      }

      if (params.action === "createMany" || params.action === "createManyAndReturn") {
        const data = params.args.data;
        params.args.data = Array.isArray(data)
          ? data.map((d: Record<string, unknown>) =>           ({ ...sanitizeRoot(d, societeId), societeId }))
                    : { ...sanitizeRoot(data, societeId), societeId };
        return next(params);
      }

      return next(params);
    });
  }

  // Tables de liaison lues à travers plusieurs sociétés (voir
  // TENANT_WRITE_SCOPED_MODELS) : lectures libres, mais une société ne peut
  // créer/modifier/supprimer QUE ses propres lignes.
  private scopeWritesOnly(params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) return next(params);
    params.args = params.args ?? {};
    const verifier = (d: unknown) => {
      if (isPlainObject(d) && d.societeId !== societeId) throw new ForbiddenException("Opération réservée à votre société.");
    };
    if (WHERE_WRITE_ACTIONS.has(params.action)) {
      params.args.where = { ...params.args.where, societeId };
    } else if (params.action === "upsert") {
      params.args.where = { ...params.args.where, societeId };
      verifier(params.args.create);
    } else if (params.action === "create") {
      verifier(params.args.data);
    } else if (params.action === "createMany") {
      for (const d of Array.isArray(params.args.data) ? params.args.data : [params.args.data]) verifier(d);
    }
    return next(params);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
