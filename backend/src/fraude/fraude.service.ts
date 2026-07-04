import { randomUUID } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FraudeService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.scoringFraude.findMany();
  }

  /**
   * Contrôle médical & fraude — règles automatiques (bloc 6 du canevas):
   * doublons d'actes, surconsommation. Un score > 50 justifie un audit
   * manuel du dossier (revue humaine, blocage paiement) plutôt qu'une
   * décision automatique — cette fonction ne fait que scorer, jamais rejeter.
   */
  async evaluerAssure(assureId: string) {
    const assure = await this.prisma.assureSante.findUnique({ where: { id: assureId } });
    if (!assure) throw new NotFoundException(`Assuré ${assureId} introuvable`);

    const prises = await this.prisma.priseEnCharge.findMany({ where: { assureId } });

    let score = 0;
    const motifs: string[] = [];

    if (prises.length > 3) {
      score += 30;
      motifs.push(`Fréquence de recours élevée (${prises.length} prises en charge)`);
    }

    const parType = new Map<string, number>();
    for (const p of prises) parType.set(p.type, (parType.get(p.type) ?? 0) + 1);
    for (const [type, count] of parType) {
      if (count > 1) {
        score += 20;
        motifs.push(`Doublon d'actes — ${type} (${count}×)`);
      }
    }

    const montantTotal = prises.reduce((sum, p) => sum + Number(p.montant), 0);
    if (montantTotal > 2_000_000) {
      score += 15;
      motifs.push(`Montant cumulé élevé (${montantTotal.toLocaleString("fr-FR")} XAF)`);
    }

    score = Math.min(score, 100);

    const record = await this.prisma.scoringFraude.create({
      data: {
        id: randomUUID(),
        cible: "Assuré",
        cibleId: assure.id,
        cibleNom: assure.nom,
        score,
        motifs: motifs.length ? motifs.join("; ") : "Aucune anomalie détectée",
        dateEvaluation: new Date().toLocaleDateString("fr-FR"),
      },
    });

    return record;
  }
}
