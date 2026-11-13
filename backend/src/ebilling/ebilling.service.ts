import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant-context';
import { CreatePayinDto } from './dto/payin.dto';
import { CreatePayoutDto } from './dto/payout.dto';

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

  // ─── Sécurité des callbacks (signature HMAC par transaction) ────────────

  private getCallbackSecret(): string | null {
    const secret = this.config.get<string>('EBILLING_CALLBACK_SECRET');
    return secret && secret.length > 0 ? secret : null;
  }

  // Refuse de créer une transaction si les callbacks ne pourraient pas être authentifiés.
  private exigerCallbackSecret(): string {
    const secret = this.getCallbackSecret();
    if (!secret) {
      this.logger.error(
        'EBILLING_CALLBACK_SECRET non configuré : paiements électroniques désactivés (callbacks inauthentifiables).',
      );
      throw new ServiceUnavailableException('Paiement électronique indisponible : configuration incomplète.');
    }
    return secret;
  }

  private signer(reference: string, secret: string): string {
    return createHmac('sha256', secret).update(reference).digest('hex');
  }

  private verifierSignature(reference: string, sig: string | undefined): void {
    const secret = this.getCallbackSecret();
    if (!secret) {
      this.logger.error('Callback E-Billing refusé : EBILLING_CALLBACK_SECRET non configuré.');
      throw new ServiceUnavailableException();
    }
    const attendu = Buffer.from(this.signer(reference, secret), 'hex');
    const recu = typeof sig === 'string' && /^[0-9a-f]{64}$/i.test(sig) ? Buffer.from(sig, 'hex') : null;
    if (!recu || recu.length !== attendu.length || !timingSafeEqual(recu, attendu)) {
      this.logger.warn('Callback E-Billing refusé : signature invalide.');
      throw new UnauthorizedException();
    }
  }

  private urlCallback(chemin: 'payin' | 'payout', reference: string, secret: string): string {
    const appUrl = this.config.get<string>('APP_URL', 'https://medassur.cloud');
    return `${appUrl}/api/ebilling/callback/${chemin}?sig=${this.signer(reference, secret)}`;
  }

  private static texte(v: unknown, max = 100): string | undefined {
    return typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;
  }

  private static nombre(v: unknown): number | undefined {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
  }

  // Montant/devise annoncés par le fournisseur, s'ils sont fournis, doivent
  // correspondre à la transaction enregistrée.
  private static coherent(
    body: Record<string, unknown>,
    tx: { montant: number },
  ): boolean {
    const montant = EbillingService.nombre(body.amount ?? body.amount_paid ?? body.montant);
    if (montant !== undefined && Math.round(montant * 100) !== Math.round(tx.montant * 100)) return false;
    const devise = body.currency;
    if (typeof devise === 'string' && devise.toUpperCase() !== 'XAF') return false;
    return true;
  }

  private static corps(body: unknown): Record<string, unknown> {
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  }

  // ─── PAYIN ────────────────────────────────────────────────────────────

  async creerPayin(
    dto: CreatePayinDto,
    userId?: string,
  ): Promise<{ reference: string; redirectUrl?: string; ussd: boolean }> {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new ForbiddenException('Aucune société associée à ce compte.');
    const secret = this.exigerCallbackSecret();

    if (dto.contratId) {
      const contrat = await this.prisma.contrat.findFirst({
        where: { id: dto.contratId, societeId },
        select: { id: true },
      });
      if (!contrat) throw new BadRequestException('Contrat introuvable.');
    }

    const reference = `PAY-${randomUUID().replace(/-/g, '').toUpperCase()}`;
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
        gestionnaireId: userId,
        statut: 'created',
      },
    });

    let data: { bill_id?: string; redirect_url?: string };
    try {
      const token = await this.getCognitoToken();

      const payload: Record<string, unknown> = {
        payment_system_name: dto.operateur,
        amount: dto.montant,
        currency: 'XAF',
        description: dto.description,
        external_reference: reference,
        callback_url: this.urlCallback('payin', reference, secret),
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
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`E-Billing invoice/create HTTP ${res.status}`);
      data = (await res.json()) as { bill_id?: string; redirect_url?: string };
    } catch (err) {
      this.logger.error(`PAYIN ${reference} : échec appel fournisseur — ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      await this.prisma.transaction.updateMany({
        where: { reference, statut: { in: ['created', 'pending'] } },
        data: { statut: 'failed' },
      });
      throw new BadGatewayException('Le fournisseur de paiement est indisponible.');
    }

    // Garde statut='created' : ne jamais écraser un callback déjà reçu.
    if (data.bill_id) {
      await this.prisma.transaction.updateMany({
        where: { reference, statut: 'created' },
        data: { ebillingId: data.bill_id, statut: 'pending' },
      });
    }

    return {
      reference,
      redirectUrl: data.redirect_url,
      ussd: !data.redirect_url,
    };
  }

  // ─── Callback PAYIN ───────────────────────────────────────────────────

  async handlePayinCallback(rawBody: unknown, sig: string | undefined): Promise<void> {
    const body = EbillingService.corps(rawBody);
    const ref = EbillingService.texte(body.external_reference) ?? EbillingService.texte(body.reference);
    if (!ref) throw new UnauthorizedException();
    this.verifierSignature(ref, sig);

    const statusMap: Record<string, string> = {
      paid: 'paid',
      success: 'paid',
      expired: 'expired',
      failed: 'failed',
      cancelled: 'failed',
    };
    const statut = statusMap[String(body.status ?? '').toLowerCase()];
    if (!statut) {
      this.logger.log(`Callback PAYIN ${ref} : statut intermédiaire/inconnu ignoré`);
      return;
    }

    const tx = await this.prisma.transaction.findFirst({
      where: { reference: ref, type: 'PAYIN' },
      select: { id: true, montant: true, statut: true, ebillingId: true },
    });
    if (!tx) return;
    // États finaux (paid/failed/expired) : immuables, les rejeux sont ignorés.
    if (tx.statut !== 'created' && tx.statut !== 'pending') return;

    const billId = EbillingService.texte(body.bill_id);
    if (!EbillingService.coherent(body, tx) || (billId && tx.ebillingId && billId !== tx.ebillingId)) {
      this.logger.warn(`Callback PAYIN ${ref} refusé : montant/devise/identifiant incohérents.`);
      return;
    }

    const fraisBrut = EbillingService.nombre(body.fees ?? body.fee_amount);
    const frais = fraisBrut !== undefined && fraisBrut >= 0 ? fraisBrut : undefined;
    const paymentSystem = EbillingService.texte(body.payment_system, 40);

    const res = await this.prisma.transaction.updateMany({
      where: { id: tx.id, statut: { in: ['created', 'pending'] } },
      data: {
        statut,
        ebillingId: billId ?? undefined,
        transactionIdOperateur: EbillingService.texte(body.transaction_id),
        operateur: paymentSystem ?? undefined,
        fraisBilling: frais,
        paidAt: statut === 'paid' ? new Date() : undefined,
      },
    });
    if (res.count === 1) {
      this.logger.log(`Callback PAYIN ${ref} → ${statut}${frais != null ? ` (frais: ${frais} XAF)` : ''}`);
    }
  }

  // ─── PAYOUT ───────────────────────────────────────────────────────────

  async creerPayout(dto: CreatePayoutDto, userId?: string): Promise<{ reference: string }> {
    const societeId = TenantContext.getSocieteId();
    if (!societeId) throw new ForbiddenException('Aucune société associée à ce compte.');
    const secret = this.exigerCallbackSecret();

    const bordereauIds = [...new Set(dto.bordereauIds ?? [])];
    let prestataireId = dto.prestataireId;

    if (prestataireId) {
      const prestataire = await this.prisma.prestataire.findFirst({
        where: { id: prestataireId, societeId },
        select: { id: true },
      });
      if (!prestataire) throw new BadRequestException('Prestataire introuvable.');
    }

    if (bordereauIds.length) {
      const bordereaux = await this.prisma.bordereauReglement.findMany({
        where: { id: { in: bordereauIds }, societeId },
        select: {
          id: true, statut: true, prestataireId: true, montantValide: true, montantTotal: true,
          transactionEbillingId: true, lettreChequeId: true,
        },
      });
      if (bordereaux.length !== bordereauIds.length) {
        throw new BadRequestException('Bordereau introuvable.');
      }
      if (bordereaux.some((b) => b.statut !== 'Validé' || b.transactionEbillingId || b.lettreChequeId)) {
        throw new ConflictException('Un bordereau n\'est pas payable (statut non "Validé" ou déjà réglé).');
      }
      const prestataires = new Set(bordereaux.map((b) => b.prestataireId));
      if (prestataires.size !== 1) {
        throw new BadRequestException('Les bordereaux doivent appartenir au même prestataire.');
      }
      const [prestataireBordereaux] = [...prestataires];
      if (prestataireId && prestataireId !== prestataireBordereaux) {
        throw new BadRequestException('Prestataire incohérent avec les bordereaux.');
      }
      prestataireId = prestataireBordereaux;

      const totalCentimes = bordereaux.reduce(
        (s, b) => s + Math.round(Number(b.montantValide ?? b.montantTotal) * 100),
        0,
      );
      if (totalCentimes !== Math.round(dto.montant * 100)) {
        throw new BadRequestException('Le montant ne correspond pas au total des bordereaux sélectionnés.');
      }
    }

    const reference = `OUT-${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const baseUrl = this.config.get<string>(
      'SHAP_BASE_URL',
      'https://lab.billing-easy.net',
    );

    // Création + prise des bordereaux atomiques : l'updateMany conditionnel
    // empêche qu'un même bordereau soit décaissé deux fois en parallèle.
    const tx = await this.prisma.$transaction(async (db) => {
      const cree = await db.transaction.create({
        data: {
          societeId,
          reference,
          type: 'PAYOUT',
          montant: dto.montant,
          description: dto.description,
          operateur: dto.operateur,
          payeurMsisdn: dto.msisdn,
          payeurNom: dto.nom,
          prestataireId,
          gestionnaireId: userId,
          statut: 'created',
        },
      });
      if (bordereauIds.length) {
        const prise = await db.bordereauReglement.updateMany({
          where: {
            id: { in: bordereauIds },
            societeId,
            statut: 'Validé',
            transactionEbillingId: null,
            lettreChequeId: null,
          },
          data: { statut: 'En attente MM', transactionEbillingId: cree.id },
        });
        if (prise.count !== bordereauIds.length) {
          throw new ConflictException('Bordereau déjà en cours de règlement ou non "Validé".');
        }
      }
      return cree;
    });

    let data: { payout_id?: string };
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
          callback_url: this.urlCallback('payout', reference, secret),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`SHAP payout/create HTTP ${res.status}`);
      data = (await res.json()) as { payout_id?: string };
    } catch (err) {
      this.logger.error(`PAYOUT ${reference} : échec appel fournisseur — ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      await this.prisma.$transaction([
        this.prisma.transaction.updateMany({
          where: { id: tx.id, statut: { in: ['created', 'pending'] } },
          data: { statut: 'failed' },
        }),
        this.prisma.bordereauReglement.updateMany({
          where: { transactionEbillingId: tx.id, statut: 'En attente MM' },
          data: { statut: 'Validé', transactionEbillingId: null },
        }),
      ]);
      throw new BadGatewayException('Le fournisseur de paiement est indisponible.');
    }

    // Garde statut='created' : ne jamais écraser un callback déjà reçu.
    await this.prisma.transaction.updateMany({
      where: { id: tx.id, statut: 'created' },
      data: { payoutId: data.payout_id ?? undefined, statut: 'pending' },
    });

    return { reference };
  }

  // ─── Callback PAYOUT ──────────────────────────────────────────────────

  async handlePayoutCallback(rawBody: unknown, sig: string | undefined): Promise<void> {
    const body = EbillingService.corps(rawBody);
    const ref = EbillingService.texte(body.reference);
    if (!ref) throw new UnauthorizedException();
    this.verifierSignature(ref, sig);

    const status = String(body.status ?? '').toLowerCase();
    const echecs = ['failed', 'failure', 'error', 'rejected', 'refused', 'cancelled', 'canceled', 'expired'];
    const statut = status === 'success' || status === 'paid' ? 'paid' : echecs.includes(status) ? 'failed' : null;
    if (!statut) {
      this.logger.log(`Callback PAYOUT ${ref} : statut intermédiaire/inconnu ignoré`);
      return;
    }

    const tx = await this.prisma.transaction.findFirst({
      where: { reference: ref, type: 'PAYOUT' },
      select: { id: true, montant: true, statut: true, payoutId: true },
    });
    if (!tx) return;
    // États finaux (paid/failed) : immuables — un "failed" rejoué ne peut pas
    // annuler un "paid", et inversement.
    if (tx.statut !== 'created' && tx.statut !== 'pending') return;

    const payoutId = EbillingService.texte(body.payout_id);
    if (!EbillingService.coherent(body, tx) || (payoutId && tx.payoutId && payoutId !== tx.payoutId)) {
      this.logger.warn(`Callback PAYOUT ${ref} refusé : montant/devise/identifiant incohérents.`);
      return;
    }

    const fraisBrut = EbillingService.nombre(body.fees ?? body.fee_amount);
    const frais = fraisBrut !== undefined && fraisBrut >= 0 ? fraisBrut : undefined;
    const now = new Date();

    const applique = await this.prisma.$transaction(async (db) => {
      const res = await db.transaction.updateMany({
        where: { id: tx.id, statut: { in: ['created', 'pending'] } },
        data: {
          statut,
          payoutId: payoutId ?? undefined,
          transactionIdOperateur: EbillingService.texte(body.transaction_id),
          fraisBilling: frais,
          paidAt: statut === 'paid' ? now : undefined,
        },
      });
      if (res.count !== 1) return false;

      if (statut === 'paid') {
        await db.bordereauReglement.updateMany({
          where: { transactionEbillingId: tx.id },
          data: {
            statut: 'Payé',
            datePaiement: now.toISOString().slice(0, 10),
            referenceVirement: ref,
          },
        });
      } else {
        // Paiement échoué → remettre les bordereaux en "Validé"
        await db.bordereauReglement.updateMany({
          where: { transactionEbillingId: tx.id, statut: 'En attente MM' },
          data: { statut: 'Validé', transactionEbillingId: null },
        });
      }
      return true;
    });

    if (applique) {
      this.logger.log(`Callback PAYOUT ${ref} → ${statut}${frais != null ? ` (frais: ${frais} XAF)` : ''}`);
    }
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
