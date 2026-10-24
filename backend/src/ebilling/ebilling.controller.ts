import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EbillingService } from './ebilling.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ebilling')
export class EbillingController {
  constructor(private readonly service: EbillingService) {}

  // ── PAYIN : initier un encaissement ────────────────────────────────────

  @Post('payin')
  @UseGuards(JwtAuthGuard)
  creerPayin(
    @Body()
    body: {
      montant: number;
      description: string;
      operateur: string;
      msisdn?: string;
      nom?: string;
      email?: string;
      contratId?: string;
      gestionnaireId?: string;
    },
  ) {
    return this.service.creerPayin(body);
  }

  // ── Callback PAYIN — pas de JwtAuthGuard (appelé par E-Billing) ────────

  @Post('callback/payin')
  async callbackPayin(@Body() body: unknown) {
    await this.service.handlePayinCallback(
      body as {
        reference?: string;
        external_reference?: string;
        status?: string;
        bill_id?: string;
        transaction_id?: string;
        payment_system?: string;
      },
    );
    return { ok: true };
  }

  // ── PAYOUT : initier un décaissement ───────────────────────────────────

  @Post('payout')
  @UseGuards(JwtAuthGuard)
  creerPayout(
    @Body()
    body: {
      montant: number;
      msisdn: string;
      operateur: string;
      description: string;
      nom?: string;
      prestataireId?: string;
      gestionnaireId?: string;
    },
  ) {
    return this.service.creerPayout(body);
  }

  // ── Callback PAYOUT — pas de JwtAuthGuard (appelé par SHAP) ───────────

  @Post('callback/payout')
  async callbackPayout(@Body() body: unknown) {
    await this.service.handlePayoutCallback(
      body as {
        reference?: string;
        status?: string;
        payout_id?: string;
        transaction_id?: string;
      },
    );
    return { ok: true };
  }

  // ── Liste des transactions ──────────────────────────────────────────────

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  lister(
    @Query('type') type?: string,
    @Query('statut') statut?: string,
  ) {
    return this.service.lister(type, statut);
  }

  @Get('transactions/:reference')
  @UseGuards(JwtAuthGuard)
  detail(@Param('reference') reference: string) {
    return this.service.detail(reference);
  }
}
