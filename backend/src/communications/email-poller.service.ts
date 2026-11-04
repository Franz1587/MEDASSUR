import { randomUUID } from "crypto";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Cron } from "@nestjs/schedule";
import { ImapFlow } from "imapflow";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "./email.service";

// CC systématique sur toutes les réponses ARIANA — le gestionnaire La Ruche
// reçoit une copie de chaque échange initié par l'IA depuis contacts@medassur.cloud.
const ARIANA_EMAIL_CC = "o.lekogo@laruchexcellence.com";

// Polling IMAP contacts@medassur.cloud (2026-11) — toutes les minutes.
// Emails entrants → ARIANA (plein accès aux outils : stats, réseau de soins,
// base connaissance) répond + envoie par email avec pièces jointes éventuelles
// + enregistre les deux (entrant + réponse) dans Communications.
// Si l'email est une réponse à une communication sortante récente (72h),
// on l'enregistre comme retour sans réponse ARIANA (dialogue déjà en cours).
@Injectable()
export class EmailPollerService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(EmailPollerService.name);
  // shortcut: ModuleRef.get (strict: false) pour éviter la dépendance circulaire
  // CommunicationsModule → MessagerieModule → DocumentsModule → CommunicationsModule.
  // Upgrader vers un import de module si ARIANA email nécessite un scope de tenant.
  private agentIa: import("../messagerie/agent-ia.service").MessagerieAgentIaService | null = null;

  // societeId La Ruche Excellence résolu au démarrage (jamais depuis TenantContext :
  // le poller tourne hors requête HTTP, l'AsyncLocalStorage est vide).
  private societeId: string | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    try {
      const { MessagerieAgentIaService } = await import("../messagerie/agent-ia.service");
      this.agentIa = this.moduleRef.get(MessagerieAgentIaService, { strict: false });
    } catch {
      this.logger.warn("MessagerieAgentIaService indisponible — réponses ARIANA désactivées.");
    }
    // Résoudre La Ruche Excellence une seule fois (première société non-bootstrap
    // dont le nom contient "Ruche").
    const p = await this.prisma.parametresEntreprise.findFirst({
      where: { nom: { contains: "Ruche", mode: "insensitive" } },
      select: { id: true, nom: true },
    });
    if (p) {
      this.societeId = p.id;
      this.logger.log(`ARIANA email → société : ${p.nom} (${p.id})`);
    } else {
      this.logger.warn("Société La Ruche introuvable — ARIANA email désactivée.");
    }
  }

  get actif(): boolean {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  async onModuleDestroy() { /* connexions IMAP fermées après chaque poll */ }

  @Cron("* * * * *")
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
        const messages = client.fetch({ seen: false }, { envelope: true, source: true });
        for await (const msg of messages as AsyncIterable<any>) {
          await this.traiterMessage(msg);
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
    const texte = this.extraireTexte(msg.source);

    if (!fromAddress) return;

    // Réponse à une communication sortante récente → enregistrer comme retour, pas de réponse ARIANA
    const limite = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const sortante = await this.prisma.communication.findFirst({
      where: { destinataireContact: fromAddress, canal: "Email", createdAt: { gte: limite }, statut: "Envoyé" },
      orderBy: { createdAt: "desc" },
    });

    if (sortante && !sortante.retour) {
      // Rattacher comme retour sur le fil sortant — mais continuer le traitement
      // pour créer une Communication entrante et laisser ARIANA répondre.
      await this.prisma.communication.update({ where: { id: sortante.id }, data: { retour: texte, retourDate: date } });
      if (sortante.auteurId) {
        await this.notifications.create("Gestionnaire", sortante.auteurId, `Réponse email de ${fromNom} : ${texte.slice(0, 100)}`).catch(() => undefined);
      }
      this.logger.log(`Email retour rattaché à communication ${sortante.id}`);
    }

    // Nouveau message entrant — ARIANA prend la main
    const commId = randomUUID();
    await this.prisma.communication.create({
      data: {
        id: commId, canal: "Email", destinataireType: "Prospect",
        destinataireNom: fromNom, destinataireContact: fromAddress,
        objet: subject, contenu: texte, statut: "Reçu", declencheur: "Webhook",
      },
    });
    this.logger.log(`Email entrant enregistré (id=${commId}) depuis ${fromAddress}`);

    // ARIANA répond uniquement pour La Ruche Excellence (societeId résolu au démarrage)
    if (!this.societeId || !this.agentIa) return;
    const reponseAriana = await this.agentIa.repondreAEmail(fromAddress, fromNom, subject, texte, this.societeId).catch((err) => {
      this.logger.error("repondreAEmail échoué", err instanceof Error ? err.message : String(err));
      return null;
    });
    if (reponseAriana?.texte) {
      const sujetReponse = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
      const ok = await this.email.envoyer(fromAddress, sujetReponse, reponseAriana.texte, "Ariana — MEDASSUR+", reponseAriana.attachments, ARIANA_EMAIL_CC);
      const statut = ok ? "Envoyé" : "Simulé";
      await this.prisma.communication.create({
        data: {
          id: randomUUID(), canal: "Email", destinataireType: "Prospect",
          destinataireNom: fromNom, destinataireContact: fromAddress,
          objet: sujetReponse, contenu: reponseAriana.texte, statut, declencheur: "ARIANA",
        },
      });
      this.logger.log(`ARIANA a répondu à ${fromAddress} (statut=${statut}, piecesJointes=${reponseAriana.attachments.length})`);
    }

    // Notification interne
    const gestionnaire = await this.prisma.user.findFirst({ where: { roleId: { startsWith: "gestionnaire_" } }, select: { id: true } });
    if (gestionnaire) {
      await this.notifications.create("Gestionnaire", gestionnaire.id,
        `Email entrant de ${fromNom} <${fromAddress}>${reponseAriana?.texte ? " — ARIANA a répondu" : ""} : ${subject}`
      ).catch(() => undefined);
    }
  }

  private extraireTexte(source?: Buffer): string {
    if (!source) return "";
    const raw = source.toString("utf8");
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
    return raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("--") && !l.match(/^[A-Za-z-]+:/))
      .join(" ")
      .trim()
      .slice(0, 500);
  }
}
