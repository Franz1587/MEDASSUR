import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditLogService } from "./audit-log.service";

const ACTION_BY_METHOD: Record<string, string> = {
  POST: "Créé",
  PATCH: "Modifié",
  PUT: "Modifié",
  DELETE: "Clôturé",
};

/**
 * Traçabilité transversale (bloc 8 du canevas) — journalise automatiquement
 * qui a fait quoi, quand, sur toute mutation (POST/PATCH/PUT/DELETE) de
 * l'API, sans que chaque module ait à s'en préoccuper individuellement.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const action = ACTION_BY_METHOD[req.method];
    if (!action) return next.handle();

    const segments = String(req.route?.path ?? req.url).split("/").filter(Boolean);
    const entite = (segments[0] === "api" ? segments[1] : segments[0]) ?? "inconnu";
    const utilisateur = req.user?.email ?? "anonyme";

    return next.handle().pipe(
      tap((result: unknown) => {
        const entiteId = String((result as { id?: unknown } | undefined)?.id ?? req.params?.id ?? "n/a");
        this.auditLogService.log(entite, entiteId, action, utilisateur).catch(() => {});
      }),
    );
  }
}
