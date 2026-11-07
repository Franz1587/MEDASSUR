import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";
import { ALLOW_EXTERNAL_KEY, IS_PUBLIC_KEY, REQUIRE_MODULE_KEY } from "./access.decorators";

export const EXTERNAL_ROLE_IDS = [
  "prestataire_sante", "client_particulier", "client_entreprise",
  "assure_principal", "medecin_prescripteur",
] as const;

/** Rôles qui ne sont jamais soumis au contrôle de modules (propriétaires de périmètre). */
const MODULE_BYPASS_ROLES = ["super_admin", "administrateur"];

/**
 * Garde globale d'autorisation, exécutée après GlobalJwtAuthGuard :
 *  - une route sans @Roles est refusée aux comptes externes, sauf @AllowExternal() ;
 *  - @RequireModule(...) est vérifié contre User.modules relu en base.
 */
@Injectable()
export class GlobalAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;

    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, targets);
    const hasRoles = !!roles && roles.length > 0;
    const allowExternal = this.reflector.getAllAndOverride<boolean>(ALLOW_EXTERNAL_KEY, targets);

    if (hasRoles && !roles!.includes(user.roleId)) {
      throw new ForbiddenException("Rôle non autorisé pour cette opération.");
    }

    if (!hasRoles && !allowExternal && (EXTERNAL_ROLE_IDS as readonly string[]).includes(user.roleId)) {
      throw new ForbiddenException("Accès réservé au personnel interne.");
    }

    const modules = this.reflector.getAllAndOverride<string[]>(REQUIRE_MODULE_KEY, targets);
    if (modules && modules.length > 0 && !MODULE_BYPASS_ROLES.includes(user.roleId)) {
      const owned: string[] = Array.isArray(user.modules) ? user.modules : [];
      if (!modules.some((m) => owned.includes(m))) {
        throw new ForbiddenException("Module non autorisé pour ce compte.");
      }
    }
    return true;
  }
}
