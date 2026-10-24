import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant-context';

interface CachedToken {
  value: string;
  expiresAt: number; // ms timestamp
}

@Injectable()
export class EbillingService {
  private readonly logger = new Logger(EbillingService.name);
  private cognitoToken: CachedToken | null = null;
  private shapToken: CachedToken | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Auth Cognito (PAYIN) ──────────────────────────────────────────────

  private async getCognitoToken(): Promise<string> {
    const now = Date.now();
    if (this.cognitoToken && this.cognitoToken.expiresAt > now + 60_000) {
      return this.cognitoToken.value;
    }

    const tokenUrl = this.config.get<string>(
      'EBILLING_TOKEN_URL',
      'https://lab.billing-easy.net/oauth/token',
    );
    const clientId = this.config.getOrThrow<string>('EBILLING_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('EBILLING_CLIENT_SECRET');

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'ebilling-api/invoice:create ebilling-api/invoice:read',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cognito token error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.cognitoToken = {
      value: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };
    return this.cognitoToken.value;
  }

  // ─── Auth SHAP (PAYOUT) ────────────────────────────────────────────────

  private async getShapToken(): Promise<string> {
    const now = Date.now();
    if (this.shapToken && this.shapToken.expiresAt > now + 60_000) {
      return this.shapToken.value;
    }

    const baseUrl = this.config.get<string>(
      'SHAP_BASE_URL',
      'https://lab.billing-easy.net',
    );
    const apiId = this.config.getOrThrow<string>('SHAP_API_ID');
    const apiSecret = this.config.getOrThrow<string>('SHAP_API_SECRET');

    const res = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_id: apiId, api_secret: apiSecret }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SHAP auth error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { token: string; expires_in?: number };
    this.shapToken = {
      value: data.token,
      expiresAt: now + (data.expires_in ?? 7200) * 1000,
    };
    return this.shapToken.value;
  }

  // ─── PAYIN ────────────────────────────────────────────────────────────

  async creerPayin(dto: {
    montant: number;
    description: string;
    operateur: string; // AIRTELMONEY | MOOVMONEY4 | VISA_MASTERCARD | SIMU
    msisdn?: string;
    nom?: string;
    email?: string;
    contratId?: string;
    gestionnaireId?: string;
  }): Promise<{ reference: string; redirectUrl?: string; ussd: boolean }> {
    const societeId = TenantContext.getSocieteId() ?? 'societe-bootstrap';
    const reference = `PAY-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const appUrl = this.config.get<string>('APP_URL', 'https://medassur.cloud');
    const baseUrl = this.config.get<string>(
      'EBILLING_BASE_URL',
      'https://lab.billing-easy.net',
    );

    await this.prisma.transaction.create({
      data: {
        societeId,
        reference,
        type: 'PAYIN',
        montant: dto.montant,
        description: dto.description,
        operateur: dto.operateur,
        payeurMsisdn: dto.msisdn,
        payeurNom: dto.nom,
        payeurEmail: dto.email,
        contratId: dto.contratId,
        gestionnaireId: dto.gestionnaireId,
        statut: 'created',
      },
    });

    try {
      const token = await this.getCognitoToken();

      const payload: Record<string, unknown> = {
        payment_system_name: dto.operateur,
        amount: dto.montant,
        currency: 'XAF',
        description: dto.description,
        external_reference: reference,
        callback_url: `${appUrl}/api/ebilling/callback/payin`,
        success_url: `${appUrl}/paiement/succes?ref=${reference}`,
        failure_url: `${appUrl}/paiement/echec?ref=${reference}`,
      };

      if (dto.msisdn || dto.nom || dto.email) {
        payload.customer = {
          msisdn: dto.msisdn,
          name: dto.nom,
          email: dto.email,
        };
      }

      const res = await fetch(`${baseUrl}/api/invoice/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        bill_id?: string;
        redirect_url?: string;
      };

      if (data.bill_id) {
        await this.prisma.transaction.update({
          where: { reference },
          data: { ebillingId: data.bill_id, statut: 'pending' },
        });
      }

      return {
        reference,
        redirectUrl: data.redirect_url,
        ussd: !data.redirect_url,
      };
    } catch (err) {
      // Marquer la transaction comme échouée si l'appel API plante
      await this.prisma.transaction.update({
        where: { reference },
        data: { statut: 'failed' },
      });
      throw err;
    }
  }

  // ─── Callback PAYIN ───────────────────────────────────────────────────

  async handlePayinCallback(body: {
    reference?: string;
    external_reference?: string;
    status?: string;
    bill_id?: string;
    transaction_id?: string;
    payment_system?: string;
    fees?: number;
    fee_amount?: number;
  }): Promise<void> {
    const ref = body.external_reference ?? body.reference;
    if (!ref) return;

    const statusMap: Record<string, string> = {
      paid: 'paid',
      success: 'paid',
      expired: 'expired',
      failed: 'failed',
      cancelled: 'failed',
    };
    const statut = statusMap[body.status ?? ''] ?? 'failed';
    const frais = body.fees ?? body.fee_amount ?? undefined;

    await this.prisma.transaction.updateMany({
      where: { reference: ref },
      data: {
        statut,
        ebillingId: body.bill_id ?? undefined,
        transactionIdOperateur: body.transaction_id ?? undefined,
        operateur: body.payment_system ?? undefined,
        fraisBilling: frais != null ? Number(frais) : undefined,
        paidAt: statut === 'paid' ? new Date() : undefined,
      },
    });

    this.logger.log(`Callback PAYIN ${ref} → ${statut}${frais != null ? ` (frais: ${frais} XAF)` : ''}`);
  }

  // ─── PAYOUT ───────────────────────────────────────────────────────────

  async creerPayout(dto: {
    montant: number;
    msisdn: string;
    operateur: string; // airtelmoney | moovmoney4
    description: string;
    nom?: string;
    prestataireId?: string;
    gestionnaireId?: string;
    bordereauIds?: string[]; // IDs de BordereauReglement à lier et marquer payés
  }): Promise<{ reference: string }> {
    const societeId = TenantContext.getSocieteId() ?? 'societe-bootstrap';
    const reference = `OUT-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const appUrl = this.config.get<string>('APP_URL', 'https://medassur.cloud');
    const baseUrl = this.config.get<string>(
      'SHAP_BASE_URL',
      'https://lab.billing-easy.net',
    );

    await this.prisma.transaction.create({
      data: {
        societeId,
        reference,
        type: 'PAYOUT',
        montant: dto.montant,
        description: dto.description,
        operateur: dto.operateur,
        payeurMsisdn: dto.msisdn,
        payeurNom: dto.nom,
        prestataireId: dto.prestataireId,
        gestionnaireId: dto.gestionnaireId,
        statut: 'created',
        // Lier les bordereaux de règlement prestataire (paiement Mobile Money)
        ...(dto.bordereauIds?.length
          ? { bordereaux: { connect: dto.bordereauIds.map((id) => ({ id })) } }
          : {}),
      },
    });

    // Marquer les bordereaux liés "En attente paiement Mobile Money"
    if (dto.bordereauIds?.length) {
      await this.prisma.bordereauReglement.updateMany({
        where: { id: { in: dto.bordereauIds } },
        data: { statut: 'En attente MM' },
      });
    }

    try {
      const token = await this.getShapToken();

      const res = await fetch(`${baseUrl}/payout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: dto.montant,
          currency: 'XAF',
          msisdn: dto.msisdn,
          operator: dto.operateur,
          reference,
          description: dto.description,
          callback_url: `${appUrl}/api/ebilling/callback/payout`,
        }),
      });

      const data = (await res.json()) as { payout_id?: string };

      await this.prisma.transaction.update({
        where: { reference },
        data: { payoutId: data.payout_id ?? undefined, statut: 'pending' },
      });
    } catch (err) {
      await this.prisma.transaction.update({
        where: { reference },
        data: { statut: 'failed' },
      });
      throw err;
    }

    return { reference };
  }

  // ─── Callback PAYOUT ──────────────────────────────────────────────────

  async handlePayoutCallback(body: {
    reference?: string;
    status?: string;
    payout_id?: string;
    transaction_id?: string;
    fees?: number;
    fee_amount?: number;
  }): Promise<void> {
    if (!body.reference) return;

    const statut =
      body.status === 'success' || body.status === 'paid' ? 'paid' : 'failed';
    const frais = body.fees ?? body.fee_amount ?? undefined;
    const now = new Date();

    await this.prisma.transaction.updateMany({
      where: { reference: body.reference },
      data: {
        statut,
        payoutId: body.payout_id ?? undefined,
        transactionIdOperateur: body.transaction_id ?? undefined,
        fraisBilling: frais != null ? Number(frais) : undefined,
        paidAt: statut === 'paid' ? now : undefined,
      },
    });

    // Si paiement confirmé → marquer les bordereaux liés comme "Payé"
    if (statut === 'paid') {
      const tx = await this.prisma.transaction.findFirst({
        where: { reference: body.reference },
        select: { id: true, reference: true },
      });
      if (tx) {
        const dateStr = now.toISOString().slice(0, 10);
        await this.prisma.bordereauReglement.updateMany({
          where: { transactionEbillingId: tx.id },
          data: {
            statut: 'Payé',
            datePaiement: dateStr,
            referenceVirement: body.reference,
          },
        });
        this.logger.log(`Bordereaux liés à ${body.reference} marqués Payé`);
      }
    } else if (statut === 'failed') {
      // Paiement échoué → remettre les bordereaux en "Validé"
      const tx = await this.prisma.transaction.findFirst({
        where: { reference: body.reference },
        select: { id: true },
      });
      if (tx) {
        await this.prisma.bordereauReglement.updateMany({
          where: { transactionEbillingId: tx.id, statut: 'En attente MM' },
          data: { statut: 'Validé', transactionEbillingId: null },
        });
      }
    }

    this.logger.log(`Callback PAYOUT ${body.reference} → ${statut}${frais != null ? ` (frais: ${frais} XAF)` : ''}`);
  }

  // ─── Listing ──────────────────────────────────────────────────────────

  async lister(type?: string, statut?: string) {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new UnauthorizedException();

    return this.prisma.transaction.findMany({
      where: {
        societeId,
        ...(type ? { type } : {}),
        ...(statut ? { statut } : {}),
      },
      include: {
        bordereaux: { select: { id: true, numero: true, montantValide: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async detail(reference: string) {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new UnauthorizedException();

    return this.prisma.transaction.findFirst({
      where: { societeId, reference },
      include: {
        bordereaux: { select: { id: true, numero: true, montantValide: true, prestataireId: true } },
      },
    });
  }
}
