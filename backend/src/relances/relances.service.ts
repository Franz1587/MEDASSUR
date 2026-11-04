import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../communications/email.service";
import { TenantContext } from "../tenant/tenant-context";
import { UpsertNiveauRelanceDto } from "./dto/upsert-niveau-relance.dto";

function parseDateFR(s: string): Date | null {
  const [d, m, y] = s.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function interpoler(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

@Injectable()
export class RelancesService {
  private readonly logger = new Logger(RelancesService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ── CRUD niveaux ──────────────────────────────────────────────────────────

  findNiveaux(societeId: string) {
    return this.prisma.niveauRelance.findMany({
      where: { societeId },
      orderBy: { ordre: "asc" },
    });
  }

  async upsert(societeId: string, dto: UpsertNiveauRelanceDto) {
    if (dto.id) {
      return this.prisma.niveauRelance.update({
        where: { id: dto.id },
        data: { ordre: dto.ordre, joursAvantEcheance: dto.joursAvantEcheance, objet: dto.objet, corps: dto.corps, actif: dto.actif ?? true },
      });
    }
    return this.prisma.niveauRelance.create({
      data: { societeId, ordre: dto.ordre, joursAvantEcheance: dto.joursAvantEcheance, objet: dto.objet, corps: dto.corps, actif: dto.actif ?? true },
    });
  }

  async deleteNiveau(id: string) {
    // Supprimer d'abord les RelanceEnvoyee liées pour éviter la FK
    await this.prisma.relanceEnvoyee.deleteMany({ where: { niveauRelanceId: id } });
    return this.prisma.niveauRelance.delete({ where: { id } });
  }

  findHistorique(societeId: string) {
    return this.prisma.relanceEnvoyee.findMany({
      where: { societeId },
      include: {
        niveauRelance: { select: { ordre: true, joursAvantEcheance: true } },
        contrat: { include: { client: { select: { nom: true, email: true } } } },
      },
      orderBy: { sentAt: "desc" },
      take: 200,
    });
  }

  // ── Cron quotidien 8h UTC (10h Gabon) ───────────────────────────────────

  @Cron("0 8 * * *")
  async cronRelancesDues() {
    // Toutes les sociétés avec au moins un niveau actif
    const societes = await this.prisma.niveauRelance.findMany({
      where: { actif: true },
      select: { societeId: true },
      distinct: ["societeId"],
    });
    for (const { societeId } of societes) {
      // Contexte société : logo/couleurs de la bonne société sur l'email de relance.
      await TenantContext.run(societeId, () => this.envoyerRelancesDues(societeId)).catch((err) =>
        this.logger.error(`Relances société ${societeId}`, err instanceof Error ? err.message : String(err)),
      );
    }
  }

  // ── Envoi pour une société (appelable manuellement depuis le contrôleur) ─

  async envoyerRelancesDues(societeId: string): Promise<{ envoyees: number; ignorees: number }> {
    const niveaux = await this.prisma.niveauRelance.findMany({ where: { societeId, actif: true } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Email de l'expéditeur (nom société)
    const params = await this.prisma.parametresEntreprise.findUnique({ where: { id: societeId }, select: { nom: true, arianaEmailCc: true } });
    const nomSociete = params?.nom ?? "MEDASSUR+";
    const cc = params?.arianaEmailCc?.length ? params.arianaEmailCc : undefined;

    let envoyees = 0;
    let ignorees = 0;

    for (const niveau of niveaux) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + niveau.joursAvantEcheance);

      // Contrats actifs de cette société dont dateFin = targetDate
      const contrats = await this.prisma.contrat.findMany({
        where: { societeId, statut: "Actif", estTest: false },
        include: {
          client: { select: { nom: true, email: true } },
          relancesEnvoyees: { where: { niveauRelanceId: niveau.id }, select: { id: true } },
        },
      });

      for (const contrat of contrats) {
        const dateFin = parseDateFR(contrat.dateFin);
        if (!dateFin) continue;
        dateFin.setHours(0, 0, 0, 0);
        // Tolérance ±1 jour pour absorber les décalages de fuseau / relance manuelle
        const diff = Math.round((dateFin.getTime() - today.getTime()) / 86_400_000);
        if (diff < niveau.joursAvantEcheance - 1 || diff > niveau.joursAvantEcheance + 1) continue;

        // Déjà envoyé pour ce niveau ?
        if (contrat.relancesEnvoyees.length > 0) { ignorees++; continue; }

        const clientEmail = contrat.client?.email;
        const vars: Record<string, string> = {
          nom: contrat.client?.nom ?? "Client",
          police: contrat.numeroPolice ?? contrat.id,
          echeance: contrat.dateFin,
          jours: String(niveau.joursAvantEcheance),
        };
        const sujet = interpoler(niveau.objet, vars);
        const corps = interpoler(niveau.corps, vars);

        let statut = "Simulé";
        if (clientEmail) {
          const ok = await this.email.envoyer(clientEmail, sujet, corps, `Ariana — ${nomSociete}`, undefined, cc);
          statut = ok ? "Envoyé" : "Simulé";
        }

        // Enregistrer dans le journal Communications
        const comm = await this.prisma.communication.create({
          data: {
            canal: "Email", destinataireType: "Client",
            destinataireId: contrat.clientId,
            destinataireNom: contrat.client?.nom ?? "",
            destinataireContact: clientEmail ?? "",
            objet: sujet, contenu: corps,
            statut, declencheur: "Relance",
            societeId,
          },
        });

        // Tracer la relance envoyée
        await this.prisma.relanceEnvoyee.create({
          data: { societeId, contratId: contrat.id, niveauRelanceId: niveau.id, statut, communicationId: comm.id },
        });
        envoyees++;
        this.logger.log(`Relance niveau ${niveau.ordre} (J-${niveau.joursAvantEcheance}) → ${clientEmail ?? "sans email"} contrat ${contrat.numeroPolice}`);
      }
    }

    this.logger.log(`Relances société ${societeId} : ${envoyees} envoyées, ${ignorees} ignorées`);
    return { envoyees, ignorees };
  }
}
