import { randomUUID } from "crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ImapFlow } from "imapflow";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

// Polling IMAP contacts@medassur.cloud (2026-11) — toutes les 5 min.
// Emails entrants → Communication "Reçu" + notification interne aux gestionnaires.
// Si l'email est une réponse à une communication sortante récente (même expéditeur,
// 72h), on l'enregistre comme retour sur cette communication (même pattern Zavu webhook).
@Injectable()
export class EmailPollerService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailPollerService.name);
  private client: ImapFlow | null = null;

  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  get actif(): boolean {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async onModuleDestroy() {
    await this.client?.logout().catch(() => undefined);
  }

  @Cron("*/5 * * * *")
  async pollInbox() {
    if (!this.actif) return;
    const host = process.env.IMAP_HOST ?? "imap.hostinger.com";
    const port = Number(process.env.IMAP_PORT ?? 993);
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;

    const client = new ImapFlow({ host, port, secure: true, auth: { user, pass }, logger: false });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Lire uniquement les non-lus
        const messages = client.fetch({ seen: false }, { envelope: true, source: true });
        for await (const msg of messages as AsyncIterable<any>) {
          await this.traiterMessage(msg);
          // Marquer comme lu pour ne pas le retraiter
          await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      this.logger.error("Échec polling IMAP", err instanceof Error ? err.message : String(err));
      await client.logout().catch(() => undefined);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async traiterMessage(msg: any) {
    const from = msg.envelope.from?.[0];
    const fromAddress = from?.address ?? "";
    const fromNom = from?.name || fromAddress;
    const subject = msg.envelope.subject ?? "(sans objet)";
    const date = msg.envelope.date ?? new Date();

    // Extraire le texte brut du source MIME (simpliste : prendre la partie lisible)
    const texte = this.extraireTexte(msg.source);

    if (!fromAddress) return;

    // Chercher une communication sortante récente vers cet expéditeur (72h)
    const limite = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const sortante = await this.prisma.communication.findFirst({
      where: { destinataireContact: fromAddress, canal: "Email", createdAt: { gte: limite }, statut: "Envoyé" },
      orderBy: { createdAt: "desc" },
    });

    if (sortante) {
      // Réponse à une communication sortante
      if (!sortante.retour) {
        await this.prisma.communication.update({ where: { id: sortante.id }, data: { retour: texte, retourDate: date } });
        if (sortante.auteurId) {
          await this.notifications.create("Gestionnaire", sortante.auteurId, `Réponse email de ${fromNom} : ${texte.slice(0, 100)}`).catch(() => undefined);
        }
        this.logger.log(`Email entrant rattaché à communication ${sortante.id} (retour de ${fromAddress})`);
      }
    } else {
      // Nouveau message entrant (pas une réponse connue)
      const id = randomUUID();
      await this.prisma.communication.create({
        data: {
          id, canal: "Email", destinataireType: "Prospect",
          destinataireNom: fromNom, destinataireContact: fromAddress,
          objet: subject, contenu: texte,
          statut: "Reçu", declencheur: "Webhook",
        },
      });
      // Notifier tous les gestionnaires actifs (shortcut: notifie le premier trouvé, à étendre si multi-gestionnaire)
      const gestionnaire = await this.prisma.user.findFirst({ where: { roleId: { startsWith: "gestionnaire_" } }, select: { id: true } });
      if (gestionnaire) {
        await this.notifications.create("Gestionnaire", gestionnaire.id, `Nouveau email entrant de ${fromNom} <${fromAddress}> : ${subject}`).catch(() => undefined);
      }
      this.logger.log(`Email entrant enregistré depuis ${fromAddress} (id=${id})`);
    }
  }

  // Extraction texte brut simpliste depuis source MIME brut
  // shortcut: ignore les pièces jointes et l'HTML complexe, suffit pour 99% des réponses
  private extraireTexte(source?: Buffer): string {
    if (!source) return "";
    const raw = source.toString("utf8");
    // Chercher content-type text/plain
    const idx = raw.toLowerCase().indexOf("content-type: text/plain");
    if (idx >= 0) {
      const apres = raw.slice(idx);
      const debut = apres.indexOf("\r\n\r\n");
      if (debut >= 0) {
        const corps = apres.slice(debut + 4);
        const fin = corps.search(/\r\n--/);
        const texte = fin >= 0 ? corps.slice(0, fin) : corps;
        return texte.replace(/\r\n/g, "\n").trim().slice(0, 2000);
      }
    }
    // Fallback : extraire les lignes lisibles (pas d'en-têtes MIME)
    return raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("--") && !l.match(/^[A-Za-z-]+:/))
      .join(" ")
      .trim()
      .slice(0, 500);
  }
}
