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

  async envoyer(to: string, subject: string, text: string, fromName = "MEDASSUR"): Promise<boolean> {
    const t = this.getTransporter();
    if (!t) { this.logger.debug("SMTP non configuré — email ignoré."); return false; }
    const from = process.env.SMTP_USER!;
    try {
      const info = await t.sendMail({
        from: `"${fromName}" <${from}>`,
        replyTo: `"${fromName}" <${from}>`,
        to,
        subject: subject || `Message de ${fromName}`,
        text,
        // En-têtes de désinscription requis par Gmail pour les envois en masse
        headers: {
          "List-Unsubscribe": `<mailto:${from}?subject=unsubscribe>`,
          "X-Mailer": "MEDASSUR",
        },
      });
      this.logger.log(`Email OK → messageId=${info.messageId} to=${to}`);
      return true;
    } catch (err) {
      this.logger.error(`Échec email à ${to}`, err instanceof Error ? err.stack : String(err));
      return false;
    }
  }
}
