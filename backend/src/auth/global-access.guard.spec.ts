import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GlobalAccessGuard } from "./global-access.guard";
import { ALLOW_EXTERNAL_KEY, IS_PUBLIC_KEY, REQUIRE_MODULE_KEY } from "./access.decorators";
import { ROLES_KEY } from "./roles.decorator";

function contexte(user: unknown, meta: Record<string, unknown>) {
  const handler = () => undefined;
  class Ctl {}
  const reflector = {
    getAllAndOverride: (cle: string) => meta[cle],
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => handler,
    getClass: () => Ctl,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { guard: new GlobalAccessGuard(reflector), ctx };
}

describe("GlobalAccessGuard", () => {
  it("laisse passer les routes publiques", () => {
    const { guard, ctx } = contexte(undefined, { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("refuse un compte externe sur une route sans règle", () => {
    const { guard, ctx } = contexte({ roleId: "assure_principal" }, {});
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("autorise un compte externe sur une route @AllowExternal", () => {
    const { guard, ctx } = contexte({ roleId: "assure_principal" }, { [ALLOW_EXTERNAL_KEY]: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("autorise un compte interne sur une route sans règle", () => {
    const { guard, ctx } = contexte({ roleId: "comptable" }, {});
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("applique @Roles", () => {
    const { guard, ctx } = contexte({ roleId: "comptable" }, { [ROLES_KEY]: ["administrateur"] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("applique @RequireModule sur les modules de l'utilisateur", () => {
    const refuse = contexte({ roleId: "comptable", modules: ["clients"] }, { [REQUIRE_MODULE_KEY]: ["banques"] });
    expect(() => refuse.guard.canActivate(refuse.ctx)).toThrow(ForbiddenException);
    const ok = contexte({ roleId: "comptable", modules: ["banques"] }, { [REQUIRE_MODULE_KEY]: ["banques"] });
    expect(ok.guard.canActivate(ok.ctx)).toBe(true);
  });

  it("l'administrateur contourne le contrôle de modules", () => {
    const { guard, ctx } = contexte({ roleId: "administrateur", modules: [] }, { [REQUIRE_MODULE_KEY]: ["banques"] });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
