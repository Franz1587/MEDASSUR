import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { GedService } from "./ged.service";

// ARIANA — rapprochement automatique GED (2026-11).
// Toutes les 5 minutes : re-passe sur les documents "Non traité" ou
// "Traité partiellement" de type "Facture prestataire" et tente un
// nouveau rapprochement (Facture, BordereauReglement, PriseEnCharge).
// Idempotent : un doc déjà "Traité totalement" ou "Sans objet" n'est
// jamais retouché ici.
// Passage de 1 min → 5 min (2026-11) : un document bloqué en "Traité
// partiellement" relançait la DB toutes les 60 s — 5 min suffit.
@Injectable()
export class GedCronService {
  private readonly logger = new Logger(GedCronService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService,
  ) {}

  @Cron("*/5 * * * *")
  async rapprochementsAuto() {
    if (this.running) return; // éviter les chevauchements si un lot met > 1 min
    this.running = true;
    try {
      // On retraite : "Non traité" (aucune saisie trouvée) OU "Traité
      // partiellement" (saisie trouvée mais statut pas encore final).
      // Limite 30 par tick pour ne pas surcharger en cas d'accumulation.
      const docs = await this.prisma.gedDocument.findMany({
        where: {
          statutTraitement: { in: ["Non traité", "Traité partiellement"] },
          type: "Facture prestataire",
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 30,
      });

      if (docs.length === 0) return;

      this.logger.log(`ARIANA cron : ${docs.length} document(s) à rapprocher`);
      let traites = 0;
      let erreurs = 0;

      for (const doc of docs) {
        try {
          await this.ged.rapprocher(doc.id);
          traites++;
        } catch {
          erreurs++;
        }
      }

      this.logger.log(`ARIANA cron terminé : ${traites} rapprochés, ${erreurs} en erreur`);
    } finally {
      this.running = false;
    }
  }
}
