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
        // Priorité au PREMIER paramètre de l'URL (2026-08) — pas forcément
        // nommé ":id" (ex. LettresClesController utilise ":code"), et pas
        // forcément le dernier sur une sous-route imbriquée (ex. POST
        // /factures/:id/lignes, PATCH /factures/:id/lignes/:ligneId) : c'est
        // le dossier PARENT qui est modifié, pas le sous-objet créé/modifié/
        // renvoyé par la réponse — Express peuple req.params dans l'ordre
        // d'apparition du pattern, donc le premier paramètre est toujours
        // celui du segment le plus à gauche (le parent). Sans cette
        // priorité, "dernière modification de la facture X" ratait tout
        // ajout/édition de ligne (voir demande utilisateur : traçabilité
        // par dossier). Repli sur l'identifiant du résultat ("id" ou "code"
        // selon le modèle) seulement pour une création à la racine (POST
        // sans paramètre dans l'URL), où il n'y a pas encore d'autre
        // identifiant connu.
        const premierParam = req.params ? Object.values(req.params)[0] : undefined;
        const resultRecord = result as Record<string, unknown> | undefined;
        const entiteId = String(premierParam ?? resultRecord?.id ?? resultRecord?.code ?? "n/a");
        this.auditLogService.log(entite, entiteId, action, utilisateur).catch(() => {});
      }),
    );
  }
}
