import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { TenantContext } from "./tenant-context";

// Alimente TenantContext.societeId à partir de req.user pour toute la durée
// de la requête (2026-09, Phase 2 multi-tenant) — voir tenant-context.ts.
// Interceptor plutôt que middleware Express : les guards (JwtAuthGuard, qui
// pose req.user) s'exécutent AVANT les interceptors dans le cycle de vie
// NestJS, donc req.user est déjà disponible ici, contrairement à un
// middleware Express classique. L'abonnement à next.handle() DOIT se faire
// À L'INTÉRIEUR du callback TenantContext.run() pour que l'exécution du
// contrôleur (et tout ce qu'elle déclenche en aval, y compris les requêtes
// Prisma asynchrones) hérite bien du contexte (AsyncLocalStorage propage
// automatiquement à travers les await/promesses déclenchées pendant le
// callback synchrone, pas après coup).
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const societeId: string | null = req?.user?.societeId ?? null;

    return new Observable((subscriber) => {
      TenantContext.run(societeId, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
