import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

// Email via SMTP Hostinger (2026-11) — contacts@medassur.cloud
// SMTP_USER / SMTP_PASS dans les variables d'environnement Coolify.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

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

  async envoyer(to: string, subject: string, text: string, fromName = "MEDASSUR", attachments?: { filename: string; content: Buffer; contentType: string }[]): Promise<boolean> {
    const t = this.getTransporter();
    if (!t) { this.logger.debug("SMTP non configuré — email ignoré."); return false; }
    const from = process.env.SMTP_USER!;
    const sujet = subject || `Message de ${fromName}`;
    // Version HTML : structure minimale mais légitime — réduit drastiquement
    // le score spam par rapport au texte brut (sans HTML, les filtres voient
    // souvent un phishing ou une notification automatique non formatée).
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${sujet}</title></head><body style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a2e;background:#f4f7fb;margin:0;padding:0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
<tr><td style="background:#1a1a2e;padding:24px 32px">
  <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.5px">MEDASSUR</span>
</td></tr>
<tr><td style="padding:32px">
  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a2e">${text.replace(/\n/g, "<br>")}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="margin:0;font-size:12px;color:#6b7280">Ce message vous a été envoyé par <strong>${fromName}</strong> via la plateforme MEDASSUR.<br>Pour toute question, répondez à cet email ou contactez-nous à <a href="mailto:${from}" style="color:#1a1a2e">${from}</a>.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
    try {
      const info = await t.sendMail({
        from: `"${fromName}" <${from}>`,
        replyTo: `"${fromName}" <${from}>`,
        to,
        subject: sujet,
        text,
        html,
        headers: { "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>` },
        ...(attachments?.length ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })) } : {}),
      });
      this.logger.log(`Email OK → messageId=${info.messageId} to=${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Échec email à ${to}`, err instanceof Error ? err.stack : String(err));
      return false;
    }
  }
}
