import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Cron } from "@nestjs/schedule";
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailService } from "./email.service";
import { TenantContext } from "../tenant/tenant-context";
import { UPLOADS_ROOT } from "../uploads-dir.util";

const UPLOADS_COMMUNICATIONS_DIR = path.join(UPLOADS_ROOT, "communications");
// CC par défaut si arianaEmailCc n'est pas encore saisi en DB.
const ARIANA_EMAIL_CC_DEFAULT = "o.lekogo@laruchexcellence.com";

function adresses(a?: AddressObject | AddressObject[]): string {
  return (Array.isArray(a) ? a : a ? [a] : []).flatMap((x) => x.value.map((v) => v.address ?? "")).filter(Boolean).join("; ");
}

async function stocker(nomOrigine: string, contenu: Buffer): Promise<string> {
  await fs.promises.mkdir(UPLOADS_COMMUNICATIONS_DIR, { recursive: true });
  const nom = `${randomUUID().slice(0, 6)}-${path.basename(nomOrigine).replace(/[^\p{L}\p{N}._ -]/gu, "_")}`;
  await fs.promises.writeFile(path.join(UPLOADS_COMMUNICATIONS_DIR, nom), contenu);
  return nom;
}

// Polling IMAP contacts@medassur.cloud (2026-11) — toutes les minutes.
// Chaque email entrant est enregistré (texte, HTML, pièces jointes) dans
// Communications ; ARIANA répond pour le compte de La Ruche Excellence.
@Injectable()
export class EmailPollerService implements OnModuleInit {
  private readonly logger = new Logger(EmailPollerService.name);
  // shortcut: ModuleRef.get (strict: false) pour éviter la dépendance circulaire
  // CommunicationsModule → MessagerieModule → DocumentsModule → CommunicationsModule.
  private agentIa: import("../messagerie/agent-ia.service").MessagerieAgentIaService | null = null;
  // Société La Ruche résolue au démarrage : le poller tourne hors requête HTTP.
  private societeId: string | null = null;
  private polling = false;

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

  @Cron("* * * * *")
  async pollInbox() {
    if (!this.actif || this.polling) return;
    this.polling = true;
    const client = new ImapFlow({
      host: process.env.IMAP_HOST ?? "imap.hostinger.com", port: Number(process.env.IMAP_PORT ?? 993), secure: true,
      auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! }, logger: false,
    });
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Lecture complète d'abord, traitement ensuite : on ne garde pas le flux IMAP
        // ouvert pendant les réponses ARIANA (plusieurs dizaines de secondes).
        const lus: { uid: number; source: Buffer }[] = [];
        for await (const msg of client.fetch({ seen: false }, { source: true }) as AsyncIterable<{ uid: number; source: Buffer }>) {
          lus.push({ uid: msg.uid, source: msg.source });
        }
        for (const m of lus) {
          await client.messageFlagsAdd({ uid: m.uid }, ["\\Seen"], { uid: true });
          // Contexte société : création des Communications, logo/couleurs des emails, outils ARIANA.
          await TenantContext.run(this.societeId, () => this.traiterMessage(m.source)).catch((err) =>
            this.logger.error("Traitement email échoué", err instanceof Error ? err.stack : String(err)));
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      this.logger.error("Échec polling IMAP", err instanceof Error ? err.message : String(err));
      await client.logout().catch(() => undefined);
    } finally {
      this.polling = false;
    }
  }

  private async traiterMessage(source: Buffer) {
    const mail: ParsedMail = await simpleParser(source);
    const from = mail.from?.value[0];
    const fromAddress = (from?.address ?? "").toLowerCase();
    if (!fromAddress) return;
    const fromNom = from?.name || fromAddress;
    const subject = mail.subject ?? "(sans objet)";
    const date = mail.date ?? new Date();
    const texte = (mail.text ?? "").trim().slice(0, 20000);
    const messageId = mail.messageId ?? `${fromAddress}|${subject}|${date.toISOString()}`;

    // Déduplication : même Message-ID déjà enregistré (\Seen pas toujours persisté par Hostinger).
    if (await this.prisma.communication.findFirst({ where: { messageId }, select: { id: true } })) {
      this.logger.log(`Email déjà traité ignoré (${messageId})`);
      return;
    }
    // Lignes antérieures sans Message-ID : même expéditeur + objet dans les 24h.
    if (await this.prisma.communication.findFirst({
      where: { messageId: null, destinataireContact: fromAddress, objet: subject, statut: "Reçu", createdAt: { gte: new Date(Date.now() - 86_400_000) } },
      select: { id: true },
    })) return;

    const pieces = await Promise.all(
      mail.attachments.filter((a) => a.contentDisposition !== "inline" || !a.cid).map((a) => stocker(a.filename ?? "piece-jointe", a.content)),
    );

    // Réponse à un envoi récent : rattachée comme retour sur le message sortant.
    const sortante = await this.prisma.communication.findFirst({
      where: { destinataireContact: { contains: fromAddress, mode: "insensitive" }, canal: "Email", createdAt: { gte: new Date(Date.now() - 72 * 3_600_000) }, statut: "Envoyé", retour: null },
      orderBy: { createdAt: "desc" },
    });
    if (sortante) {
      await this.prisma.communication.update({ where: { id: sortante.id }, data: { retour: texte.slice(0, 2000), retourDate: date } });
      if (sortante.auteurId) {
        await this.notifications.create("Gestionnaire", sortante.auteurId, `Réponse email de ${fromNom} : ${texte.slice(0, 100)}`).catch(() => undefined);
      }
    }

    const html = typeof mail.html === "string" ? mail.html : null;
    await this.prisma.communication.create({
      data: {
        id: randomUUID(), canal: "Email", destinataireType: "Prospect",
        destinataireNom: fromNom, destinataireContact: fromAddress, cc: adresses(mail.cc) || null,
        objet: subject, contenu: texte || "(message vide)", contenuHtml: html,
        piecesJointes: pieces, pieceJointe: pieces[0] ?? null,
        statut: "Reçu", declencheur: "Webhook", messageId, lu: false, createdAt: date,
      },
    });
    this.logger.log(`Email entrant enregistré depuis ${fromAddress} (${pieces.length} PJ)`);

    // Jamais de réponse automatique à soi-même ni à un répondeur : évite les boucles d'emails.
    const auto = String(mail.headers.get("auto-submitted") ?? "no").toLowerCase() !== "no"
      || /mailer-daemon|no-?reply|postmaster/.test(fromAddress)
      || fromAddress === process.env.SMTP_USER?.toLowerCase();
    let reponduParAriana = false;
    if (!auto && this.societeId && this.agentIa) {
      const params = await this.prisma.parametresEntreprise.findUnique({ where: { id: this.societeId }, select: { arianaEmailCc: true } });
      const cc = params?.arianaEmailCc?.length ? params.arianaEmailCc : [ARIANA_EMAIL_CC_DEFAULT];
      const reponse = await this.agentIa.repondreAEmail(fromAddress, fromNom, subject, texte, this.societeId).catch((err) => {
        this.logger.error("repondreAEmail échoué", err instanceof Error ? err.message : String(err));
        return null;
      });
      if (reponse?.texte) {
        const sujetReponse = /^re\s*:/i.test(subject) ? subject : `Re: ${subject}`;
        const ok = await this.email.envoyer(fromAddress, sujetReponse, reponse.texte, "Ariana — MEDASSUR+", reponse.attachments, cc);
        const piecesAriana = await Promise.all(reponse.attachments.map((a) => stocker(a.filename, a.content)));
        await this.prisma.communication.create({
          data: {
            id: randomUUID(), canal: "Email", destinataireType: "Prospect",
            destinataireNom: fromNom, destinataireContact: fromAddress, cc: cc.join("; "),
            objet: sujetReponse, contenu: reponse.texte, statut: ok ? "Envoyé" : "Simulé", declencheur: "ARIANA",
            piecesJointes: piecesAriana, pieceJointe: piecesAriana[0] ?? null,
          },
        });
        reponduParAriana = true;
        this.logger.log(`ARIANA a répondu à ${fromAddress} (ok=${ok}, PJ=${piecesAriana.length})`);
      }
    }

    const gestionnaire = await this.prisma.user.findFirst({ where: { roleId: { startsWith: "gestionnaire_" } }, select: { id: true } });
    if (gestionnaire) {
      await this.notifications.create("Gestionnaire", gestionnaire.id,
        `Email entrant de ${fromNom} <${fromAddress}>${reponduParAriana ? " — ARIANA a répondu" : ""} : ${subject}`,
      ).catch(() => undefined);
    }
  }
}
