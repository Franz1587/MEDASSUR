import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ALLOW_TEMPORARY_PASSWORD_KEY } from "./temporary-password.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  // Tant que le compte porte un mot de passe temporaire (doitChangerMotDePasse),
  // seules les routes marquées @AllowTemporaryPassword() sont accessibles.
  handleRequest(err: any, user: any, _info: any, context: ExecutionContext) {
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    if (user.doitChangerMotDePasse) {
      const autorisee = Reflect.getMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, context.getHandler())
        ?? Reflect.getMetadata(ALLOW_TEMPORARY_PASSWORD_KEY, context.getClass());
      if (!autorisee) {
        throw new ForbiddenException({
          statusCode: 403,
          code: "PASSWORD_CHANGE_REQUIRED",
          message: "Vous devez changer votre mot de passe temporaire avant de continuer.",
        });
      }
    }
    return user;
  }
}
