import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "./tenant-context";
import { TENANT_MODELS } from "./tenant-models";

// Défense en profondeur multi-tenant : le middleware Prisma ne cloisonne que
// le modèle RACINE d'un appel, jamais les ids rattachés par `connect`,
// `connectOrCreate`, `set` ou un simple champ `xxxId` fourni par le client.
// Avant d'utiliser un id fourni par l'utilisateur pour relier/mettre à jour un
// enregistrement, on vérifie donc qu'il appartient bien à la société du
// contexte courant. Sans contexte société (super_admin, script, seed) : aucun
// contrôle, comportement historique préservé.
//
// Exemple : await assertSameTenant(this.prisma, "Banque", dto.banqueId);
export async function assertSameTenant(
  prisma: PrismaService,
  model: string,
  ids: string | null | undefined | (string | null | undefined)[],
  libelle?: string,
): Promise<void> {
  if (!TenantContext.getSocieteId()) return;
  if (!TENANT_MODELS.has(model)) {
    throw new Error(`assertSameTenant : le modèle ${model} n'est pas cloisonné par société.`);
  }
  const unique = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id): id is string => !!id))];
  if (unique.length === 0) return;

  const delegate = (prisma as unknown as Record<string, { count: (args: unknown) => Promise<number> }>)[
    model.charAt(0).toLowerCase() + model.slice(1)
  ];
  // Le middleware ajoute automatiquement societeId au `where`.
  const found = await delegate.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new NotFoundException(`${libelle ?? model} introuvable.`);
  }
}
