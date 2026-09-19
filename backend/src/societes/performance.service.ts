import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Performance / usage de la plateforme (2026-09) — voir demande
// utilisateur : "un écran lui permettant de voir les performances
// d'utilisation de l'application." Aucun outil d'analytics/APM branché sur
// ce projet — construit à partir de signaux déjà réels en base : dernières
// connexions (User.derniereConnexion), volume de données par société
// (comptes métier créés), et activité journalisée (AuditLog, désormais
// cloisonné par société — voir tenant-models.ts).
const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class PerformanceService {
  constructor(private prisma: PrismaService) {}

  async parSociete() {
    const seuil30j = new Date(Date.now() - TRENTE_JOURS_MS);
    const societes = await this.prisma.societeAssurance.findMany({
      select: { id: true, nom: true, statut: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(societes.map(async (s) => {
      const [
        totalUtilisateurs, utilisateursActifs30j, dernierUtilisateurActif,
        contrats, assures, factures, prisesEnCharge, clients, prestataires,
        activite30j,
      ] = await Promise.all([
        this.prisma.user.count({ where: { societeId: s.id } }),
        this.prisma.user.count({ where: { societeId: s.id, derniereConnexion: { gte: seuil30j } } }),
        this.prisma.user.findFirst({ where: { societeId: s.id, derniereConnexion: { not: null } }, orderBy: { derniereConnexion: "desc" }, select: { derniereConnexion: true } }),
        this.prisma.contrat.count({ where: { societeId: s.id } }),
        this.prisma.assureSante.count({ where: { societeId: s.id } }),
        this.prisma.facture.count({ where: { societeId: s.id } }),
        this.prisma.priseEnCharge.count({ where: { societeId: s.id } }),
        this.prisma.client.count({ where: { societeId: s.id } }),
        this.prisma.prestataire.count({ where: { societeId: s.id } }),
        this.prisma.auditLog.count({ where: { societeId: s.id, dateAction: { gte: seuil30j } } }),
      ]);

      return {
        societeId: s.id, nom: s.nom, statut: s.statut, createdAt: s.createdAt,
        totalUtilisateurs, utilisateursActifs30j,
        derniereActivite: dernierUtilisateurActif?.derniereConnexion ?? null,
        volumeDonnees: { contrats, assures, factures, prisesEnCharge, clients, prestataires },
        operations30j: activite30j,
      };
    }));
  }

  async global() {
    const seuil30j = new Date(Date.now() - TRENTE_JOURS_MS);
    const [
      totalSocietes, societesActives, totalUtilisateurs, utilisateursActifs30j,
      totalContrats, totalAssures, totalFactures, operations30j,
    ] = await Promise.all([
      this.prisma.societeAssurance.count(),
      this.prisma.societeAssurance.count({ where: { statut: "Actif" } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { derniereConnexion: { gte: seuil30j } } }),
      this.prisma.contrat.count(),
      this.prisma.assureSante.count(),
      this.prisma.facture.count(),
      this.prisma.auditLog.count({ where: { dateAction: { gte: seuil30j } } }),
    ]);
    return { totalSocietes, societesActives, totalUtilisateurs, utilisateursActifs30j, totalContrats, totalAssures, totalFactures, operations30j };
  }
}
