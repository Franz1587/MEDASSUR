import * as fs from "fs";
import * as path from "path";
import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenant/tenant-context";
import { UPLOADS_ROOT } from "../uploads-dir.util";

export interface PieceJointeEmail { filename: string; content: Buffer; contentType: string }

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Email via SMTP Hostinger (2026-11) — contacts@medassur.cloud
// SMTP_USER / SMTP_PASS dans les variables d'environnement Coolify.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private prisma: PrismaService) {}

  get actif(): boolean {
    return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (!this.actif) return null;
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? "smtp.hostinger.com",
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }
    return this.transporter;
  }

  // Habillage de la société courante (TenantContext) : nom, couleur, logo.
  private async marque(): Promise<{ nom: string; couleur: string; logo: PieceJointeEmail | null }> {
    const societeId = TenantContext.getSocieteId();
    const p = societeId ? await this.prisma.parametresEntreprise.findUnique({ where: { id: societeId }, select: { nom: true, couleurPrimaire: true, logo: true } }) : null;
    let logo: PieceJointeEmail | null = null;
    if (p?.logo) {
      const content = await fs.promises.readFile(path.join(UPLOADS_ROOT, "logos-entreprises", p.logo)).catch(() => null);
      const ext = path.extname(p.logo).slice(1).toLowerCase();
      if (content) logo = { filename: p.logo, content, contentType: ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "png"}` };
    }
    return { nom: p?.nom ?? "MEDASSUR+", couleur: p?.couleurPrimaire ?? "#1a1a2e", logo };
  }

  async envoyer(
    to: string | string[], subject: string, text: string, fromName = "MEDASSUR+",
    attachments?: PieceJointeEmail[], cc?: string | string[], html?: string,
  ): Promise<boolean> {
    const t = this.getTransporter();
    if (!t) { this.logger.debug("SMTP non configuré — email ignoré."); return false; }
    const from = process.env.SMTP_USER!;
    const sujet = subject || `Message de ${fromName}`;
    const m = await this.marque();
    const entete = m.logo
      ? `<img src="cid:logo-societe" alt="${echapper(m.nom)}" style="max-height:56px;max-width:240px;display:block">`
      : `<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px">${echapper(m.nom)}</span>`;
    const corps = html ?? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a2e">${echapper(text).replace(/\n/g, "<br>")}</p>`;
    // Structure HTML légitime : réduit nettement le score spam par rapport au texte brut.
    const page = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${echapper(sujet)}</title></head><body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a2e;background:#f4f7fb;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
<tr><td style="background:${m.logo ? "#ffffff;border-bottom:3px solid " + m.couleur : m.couleur};padding:20px 32px">${entete}</td></tr>
<tr><td style="padding:32px;font-size:14px;line-height:1.6;color:#1a1a2e">
  ${corps}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="margin:0;font-size:12px;color:#6b7280">Ce message vous a été envoyé par <strong>${echapper(fromName)}</strong> pour le compte de <strong>${echapper(m.nom)}</strong>.<br>Pour toute question, répondez à cet email ou écrivez à <a href="mailto:${from}" style="color:${m.couleur}">${from}</a>.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
    const pj = [
      ...(attachments ?? []).map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      ...(m.logo ? [{ filename: m.logo.filename, content: m.logo.content, contentType: m.logo.contentType, cid: "logo-societe" }] : []),
    ];
    try {
      const info = await t.sendMail({
        from: `"${fromName}" <${from}>`,
        replyTo: `"${fromName}" <${from}>`,
        to,
        ...(cc && (Array.isArray(cc) ? cc.length : cc.trim()) ? { cc } : {}),
        subject: sujet,
        text,
        html: page,
        headers: { "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>` },
        ...(pj.length ? { attachments: pj } : {}),
      });
      this.logger.log(`Email OK → messageId=${info.messageId} to=${String(to)}${cc ? ` cc=${String(cc)}` : ""}`);
      return true;
    } catch (err) {
      this.logger.error(`Échec email à ${String(to)}`, err instanceof Error ? err.stack : String(err));
      return false;
    }
  }
}
