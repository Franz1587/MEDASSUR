import { randomUUID } from "crypto";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ImapFlow } from "imapflow";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "./email.service";
import { ParametresEntrepriseService } from "../parametres-entreprise/parametres-entreprise.service";

// Polling IMAP contacts@medassur.cloud (2026-11) — toutes les minutes.
// Emails entrants → ARIANA génère une réponse automatique + envoie par email
// + enregistre les deux (entrant + réponse) dans Communications.
// Si l'email est une réponse à une communication sortante récente (même expéditeur,
// 72h), on l'enregistre comme retour sans réponse ARIANA (dialogue déjà en cours).
@Injectable()
export class EmailPollerService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailPollerService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private email: EmailService,
    private parametresEntreprise: ParametresEntrepriseService,
  ) {}

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

    if (sortante) {
      if (!sortante.retour) {
        await this.prisma.communication.update({ where: { id: sortante.id }, data: { retour: texte, retourDate: date } });
        if (sortante.auteurId) {
          await this.notifications.create("Gestionnaire", sortante.auteurId, `Réponse email de ${fromNom} : ${texte.slice(0, 100)}`).catch(() => undefined);
        }
        this.logger.log(`Email retour rattaché à communication ${sortante.id}`);
      }
      return;
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

    // ARIANA répond automatiquement
    const reponseAriana = await this.genererReponseAriana(fromNom, subject, texte);
    if (reponseAriana) {
      const sujetReponse = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
      const ok = await this.email.envoyer(fromAddress, sujetReponse, reponseAriana, "Ariana — MEDASSUR+");
      const statut = ok ? "Envoyé" : "Simulé";
      await this.prisma.communication.create({
        data: {
          id: randomUUID(), canal: "Email", destinataireType: "Prospect",
          destinataireNom: fromNom, destinataireContact: fromAddress,
          objet: sujetReponse, contenu: reponseAriana, statut, declencheur: "ARIANA",
        },
      });
      this.logger.log(`ARIANA a répondu à ${fromAddress} (statut=${statut})`);
    }

    // Notification interne
    const gestionnaire = await this.prisma.user.findFirst({ where: { roleId: { startsWith: "gestionnaire_" } }, select: { id: true } });
    if (gestionnaire) {
      await this.notifications.create("Gestionnaire", gestionnaire.id,
        `Email entrant de ${fromNom} <${fromAddress}>${reponseAriana ? " — ARIANA a répondu" : ""} : ${subject}`
      ).catch(() => undefined);
    }
  }

  private getAnthropicClient(): Anthropic | null {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;
    if (!this.anthropic) this.anthropic = new Anthropic({ apiKey });
    return this.anthropic;
  }

  private async genererReponseAriana(fromNom: string, subject: string, texte: string): Promise<string | null> {
    const client = this.getAnthropicClient();
    if (!client) {
      this.logger.debug("ANTHROPIC_API_KEY non configurée — réponse ARIANA ignorée.");
      return null;
    }
    try {
      const p = await this.parametresEntreprise.findOne();
      const systemPrompt = `Tu es Ariana, conseillère clients de ${p.nom} (courtier en assurance santé au Gabon). Tu réponds aux emails entrants adressés à contacts@medassur.cloud de façon professionnelle, chaleureuse et concise. Tu signes toujours "Ariana, Conseillère Clients — ${p.nom}". Si la demande dépasse tes connaissances (sinistre complexe, accord préalable spécifique, modification de contrat), tu indiques qu'un gestionnaire va prendre contact. Ne promets jamais de délais précis. Ne cite jamais de montants ou garanties que tu ne connais pas. Réponds en français uniquement.`;
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: `De : ${fromNom}\nObjet : ${subject}\n\n${texte}` }],
      });
      const bloc = msg.content.find((b) => b.type === "text");
      return bloc && bloc.type === "text" ? bloc.text.trim() : null;
    } catch (err) {
      this.logger.error("Échec génération réponse ARIANA", err instanceof Error ? err.message : String(err));
      return null;
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
