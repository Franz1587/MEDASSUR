import * as crypto from "crypto";
import { Controller, Post, RawBody, Req, Res, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { CommunicationsService } from "./communications.service";

// Webhook entrant Zavu (2026-10) — voir demande utilisateur : "recevoir des
// retours sous forme de notification et message interne" (demande 2026-08).
// Ce contrôleur est public (pas de JwtAuthGuard) mais protégé par signature
// HMAC-SHA256. ZAVU_WEBHOOK_SECRET doit être configuré dans Coolify.
// URL de configuration côté Zavu : https://medassur.cloud/api/webhooks/zavu
@Controller("webhooks/zavu")
export class ZavuWebhookController {
  private readonly logger = new Logger(ZavuWebhookController.name);

  constructor(private readonly communications: CommunicationsService) {}

  @Post()
  async recevoir(@RawBody() rawBody: Buffer, @Req() req: Request, @Res() res: Response) {
    const secret = process.env.ZAVU_WEBHOOK_SECRET;
    if (secret) {
      const header = req.headers["x-zavu-signature"] as string | undefined;
      if (!this.verifierSignature(rawBody.toString("utf8"), header, secret)) {
        this.logger.warn("Webhook Zavu : signature invalide — requête rejetée.");
        return res.status(401).send("Invalid signature");
      }
    }
    // Accusé de réception immédiat (Zavu relance les non-2xx)
    res.status(200).send("OK");
    try {
      const event = JSON.parse(rawBody.toString("utf8"));
      await this.communications.traiterWebhookEntrant(event);
    } catch (err) {
      this.logger.error("Erreur traitement webhook Zavu", err instanceof Error ? err.stack : String(err));
    }
  }

  // Signature v2 : HMAC-SHA256 sur "TIMESTAMP.BODY" (préférée)
  // Signature v1 : HMAC-SHA256 sur "BODY" (fallback)
  private verifierSignature(rawBody: string, header: string | undefined, secret: string): boolean {
    if (!header) return false;
    const parts: Record<string, string> = {};
    for (const piece of header.split(",")) {
      const i = piece.indexOf("=");
      if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
    }
    const t = Number(parts.t);
    if (!Number.isFinite(t)) return false;
    const age = Math.floor(Date.now() / 1000) - t;
    if (age > 300 || age < -60) return false;
    const received = parts.v2 ?? parts.v1;
    if (!received) return false;
    const signed = parts.v2 ? `${t}.${rawBody}` : rawBody;
    const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }
}
