import { ForbiddenException } from "@nestjs/common";

/** Identité de l'appelant telle que posée par JwtStrategy (req.user). */
export interface Acteur {
  userId: string;
  roleId: string;
  societeId: string | null;
}

// Rang d'autorité des rôles de gestion : super_admin (plateforme) >
// administrateur (plus haut rôle d'une société) > direction_generale > autres.
const RANG_ROLE: Record<string, number> = { super_admin: 3, administrateur: 2, direction_generale: 1 };
const rang = (roleId: string) => RANG_ROLE[roleId] ?? 0;

/** Seul un super_admin sans société (niveau plateforme) peut gérer des super_admin. */
export function estSuperAdminPlateforme(acteur: Acteur): boolean {
  return acteur.roleId === "super_admin" && !acteur.societeId;
}

/** Refuse l'attribution (création ou changement) d'un rôle supérieur à celui de l'appelant. */
export function verifierPeutAttribuerRole(acteur: Acteur, roleCible: string) {
  if (roleCible === "super_admin") {
    if (!estSuperAdminPlateforme(acteur)) throw new ForbiddenException("Seul un Super Admin de la plateforme peut attribuer le rôle super_admin.");
    return;
  }
  if (rang(roleCible) > rang(acteur.roleId)) {
    throw new ForbiddenException("Vous ne pouvez pas attribuer un rôle supérieur au vôtre.");
  }
}

/** Refuse la modification/suppression d'un compte de rang supérieur à l'appelant (jamais un super_admin hors plateforme). */
export function verifierPeutModifierCompte(acteur: Acteur, roleCompteCible: string, idCompteCible?: string) {
  if (idCompteCible && idCompteCible === acteur.userId) return;
  if (roleCompteCible === "super_admin") {
    if (!estSuperAdminPlateforme(acteur)) throw new ForbiddenException("Seul un Super Admin de la plateforme peut modifier un compte super_admin.");
    return;
  }
  if (rang(roleCompteCible) > rang(acteur.roleId)) {
    throw new ForbiddenException("Vous ne pouvez pas modifier un compte de rang supérieur au vôtre.");
  }
}
