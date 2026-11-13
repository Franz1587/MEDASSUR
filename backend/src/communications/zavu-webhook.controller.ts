import * as crypto from "crypto";
import { Controller, OnModuleInit, Post, RawBody, Req, Res, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { CommunicationsService } from "./communications.service";
import { Public } from "../auth/access.decorators";

// Webhook entrant Zavu (2026-10) — voir demande utilisateur : "recevoir des
// retours sous forme de notification et message interne" (demande 2026-08).
// Ce contrôleur est public (pas de JWT) mais protégé par signature
// HMAC-SHA256. Fail-closed : sans ZAVU_WEBHOOK_SECRET, toute requête est
// rejetée (401). URL de configuration côté Zavu : https://medassur.cloud/api/webhooks/zavu
const DEDUPE_MAX = 1000;

@Public()
@Controller("webhooks/zavu")
export class ZavuWebhookController implements OnModuleInit {
  private readonly logger = new Logger(ZavuWebhookController.name);
  // Mémoire LRU (Map ordonnée par insertion) des derniers événements traités.
  private readonly dejaVus = new Map<string, true>();

  constructor(private readonly communications: CommunicationsService) {}

  onModuleInit() {
    if (!process.env.ZAVU_WEBHOOK_SECRET) {
      this.logger.warn("ZAVU_WEBHOOK_SECRET absent : le webhook Zavu est DÉSACTIVÉ (toutes les requêtes sont rejetées).");
    }
  }

  @Post()
  async recevoir(@RawBody() rawBody: Buffer | undefined, @Req() req: Request, @Res() res: Response) {
    const secret = process.env.ZAVU_WEBHOOK_SECRET;
    if (!secret) return res.status(401).send("Webhook disabled");

    const header = req.headers["x-zavu-signature"];
    const signature = typeof header === "string" ? header : undefined;
    const corps = rawBody ? rawBody.toString("utf8") : "";
    if (!corps || !this.verifierSignature(corps, signature, secret)) {
      this.logger.warn("Webhook Zavu : signature invalide — requête rejetée.");
      return res.status(401).send("Invalid signature");
    }

    let event: { id?: unknown; eventId?: unknown };
    try {
      event = JSON.parse(corps);
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    // Déduplication : id d'événement, à défaut empreinte de la signature (unique par envoi)
    const brut = event?.id ?? event?.eventId;
    const cle = typeof brut === "string" && brut ? `evt:${brut}` : `sig:${crypto.createHash("sha256").update(signature ?? "").digest("hex")}`;
    if (this.dejaVus.has(cle)) return res.status(200).send("OK");
    this.dejaVus.set(cle, true);
    if (this.dejaVus.size > DEDUPE_MAX) {
      const plusAncien = this.dejaVus.keys().next().value;
      if (plusAncien !== undefined) this.dejaVus.delete(plusAncien);
    }

    // Accusé de réception immédiat (Zavu relance les non-2xx)
    res.status(200).send("OK");
    try {
      await this.communications.traiterWebhookEntrant(event as Parameters<CommunicationsService["traiterWebhookEntrant"]>[0]);
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
