import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Observable, from, of } from "rxjs";
import { switchMap, tap } from "rxjs/operators";
import { PrismaService } from "../prisma/prisma.service";

const METHODES_MUTANTES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Voir RequeteIdempotente (schema.prisma) pour le contexte complet. Un
// client (web/mobile) qui rejoue une action après une coupure réseau envoie
// le même en-tête `Idempotency-Key` qu'à sa première tentative : si cette
// clé a déjà produit une réponse, on la renvoie telle quelle SANS ré-exécuter
// le handler (donc sans double création en base). Totalement transparent si
// l'en-tête est absent (tout le trafic existant, web comme mobile, avant
// l'ajout du mode hors-ligne) : comportement inchangé.
@Injectable()
export class IdempotenceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotenceInterceptor.name);

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const cleBrute = req.headers?.["idempotency-key"];
    const cle = typeof cleBrute === "string" ? cleBrute.trim() : "";

    if (!cle || !METHODES_MUTANTES.has(req.method)) {
      return next.handle();
    }

    return from(
      this.prisma.requeteIdempotente.findUnique({ where: { cle } }).catch(() => null),
    ).pipe(
      switchMap((existante) => {
        if (existante) return of(existante.reponse as unknown);
        return next.handle().pipe(
          tap((reponse) => {
            this.prisma.requeteIdempotente
              .create({ data: { cle, reponse: (reponse ?? {}) as any } })
              .catch((err) => this.logger.warn(`Enregistrement idempotence échoué (${cle}): ${(err as Error).message}`));
          }),
        );
      }),
    );
  }

  // Purge les clés rejouées de plus de 14 jours — largement suffisant pour
  // couvrir une coupure réseau prolongée côté client hors-ligne, évite une
  // croissance illimitée de la table.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgerAnciennesClefs(): Promise<void> {
    const limite = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await this.prisma.requeteIdempotente.deleteMany({ where: { createdAt: { lt: limite } } }).catch((err) => {
      this.logger.warn(`Purge idempotence échouée: ${(err as Error).message}`);
    });
  }
}
