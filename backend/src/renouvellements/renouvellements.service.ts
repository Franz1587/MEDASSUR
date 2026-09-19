import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AvenantsService } from "../avenants/avenants.service";
import { ResiliationsService } from "../resiliations/resiliations.service";

const INCLUDE = { contrat: { include: { client: true, compagnie: true } } } as const;

// Fenêtre de relance automatique — mêmes 30 jours que le seuil déjà annoncé
// à l'écran (StatCard "À renouveler — Sous 30 jours").
const SEUIL_RELANCE_AUTO_JOURS = 30;

function joursRestants(dateFin: string): number {
  const [d, m, y] = dateFin.split("/").map(Number);
  if (!d || !m || !y) return 0;
  const cible = new Date(y, m - 1, d);
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24));
}

interface AvenantRenouvellement {
  id: string;
  contratId: string;
  primeAvant: Prisma.Decimal;
  primeApres: Prisma.Decimal;
  sinistralite: string | null;
  statut: string;
  contrat: { clientId: string; branche: string; dateFin: string; gestionnaireId: string | null; client: { nom: string }; compagnie: { nom: string } };
}

// Simple adaptateur de lecture/écriture sur `Avenant` (type "Renouvellement")
// — plus de table `Renouvellement` propre (voir schema.prisma). Contrôleur,
// routes et forme de réponse ("joursRestants"/"primeActuelle"/"primeProposee")
// inchangés pour ne rien casser côté frontend.
@Injectable()
export class RenouvellementsService implements OnModuleInit {
  constructor(private prisma: PrismaService, private avenants: AvenantsService, private resiliations: ResiliationsService) {}

  async onModuleInit() {
    await this.relancerAutomatiquement();
  }

  private mapper(a: AvenantRenouvellement) {
    return {
      id: a.id,
      contratId: a.contratId,
      joursRestants: joursRestants(a.contrat.dateFin),
      primeActuelle: a.primeAvant,
      primeProposee: a.primeApres,
      sinistralite: a.sinistralite,
      // "Renouvelé" reste le libellé externe historique de cet écran — en
      // interne, Avenant utilise le même statut terminal "Appliqué" que
      // tous les autres types (voir AvenantsService.appliquer).
      statut: a.statut === "Appliqué" ? "Renouvelé" : a.statut,
      contrat: a.contrat,
    };
  }

  async findAll() {
    const avenants = await this.prisma.avenant.findMany({
      where: { type: "Renouvellement" },
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return avenants.map((a) => this.mapper(a));
  }

  private async findOneOrThrow(id: string) {
    const a = await this.prisma.avenant.findUnique({ where: { id }, include: INCLUDE });
    if (!a || a.type !== "Renouvellement") throw new NotFoundException(`Renouvellement ${id} introuvable`);
    return a;
  }

  async relancer(id: string) {
    await this.findOneOrThrow(id);
    return this.mapper(await this.avenants.setStatut(id, "Relancé"));
  }

  async relancerToutes() {
    const aRelancer = await this.prisma.avenant.findMany({ where: { type: "Renouvellement", statut: "À renouveler" } });
    await this.prisma.avenant.updateMany({ where: { type: "Renouvellement", statut: "À renouveler" }, data: { statut: "Relancé" } });
    return { relances: aRelancer.length };
  }

  // Le renouvellement est un type d'avenant : "renouveler" == "appliquer"
  // l'avenant (voir AvenantsService.appliquer, qui clôture l'exercice,
  // en crée un nouveau et prolonge le contrat pour ce type précis).
  async renouveler(id: string) {
    await this.findOneOrThrow(id);
    return this.mapper(await this.avenants.appliquer(id));
  }

  // Un renouvellement perdu n'est pas qu'un changement d'étiquette : il doit
  // aboutir à une vraie résiliation du contrat (workflow normal Demandée →
  // Validée → Effective, écran Résiliations existant — pas de court-circuit
  // direct vers "contrat résilié" sans validation). Réutilise
  // ResiliationsService.create(), la même fonction que l'écran Résiliations
  // utilise pour toute autre demande.
  async marquerPerdu(id: string, initiateur: string) {
    const avenant = await this.findOneOrThrow(id);
    await this.resiliations.create({
      contratId: avenant.contratId,
      motif: "Non-renouvellement",
      dateEffet: avenant.contrat.dateFin,
      ristourne: 0,
      initiateur,
      statut: "Demandée",
    });
    return this.mapper(await this.avenants.setStatut(id, "Perdu"));
  }

  // Relance automatique programmée — même principe que la radiation
  // automatique hors limite d'âge (MouvementsService.radierHorsLimiteAge) :
  // tourne chaque nuit et une fois au démarrage (onModuleInit) pour
  // rattraper tout retard. Ne relance que les contrats entrant dans la
  // fenêtre des 30 jours avant échéance — un contrat "À renouveler" encore
  // loin de son échéance n'est pas concerné pour l'instant.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async relancerAutomatiquement() {
    const candidats = await this.prisma.avenant.findMany({
      where: { type: "Renouvellement", statut: "À renouveler" },
      include: { contrat: true },
    });
    const idsARelancer = candidats
      .filter((a) => joursRestants(a.contrat.dateFin) <= SEUIL_RELANCE_AUTO_JOURS)
      .map((a) => a.id);
    if (idsARelancer.length === 0) return { relances: 0 };
    await this.prisma.avenant.updateMany({ where: { id: { in: idsARelancer } }, data: { statut: "Relancé" } });
    return { relances: idsARelancer.length };
  }
}
