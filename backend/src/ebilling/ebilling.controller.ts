import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { EbillingService } from './ebilling.service';
import { Public, RequireModule } from '../auth/access.decorators';
import { Roles } from '../auth/roles.decorator';
import { CreatePayinDto } from './dto/payin.dto';
import { CreatePayoutDto } from './dto/payout.dto';

// Rôles financiers/direction : encaissements et consultation des transactions.
const ROLES_FINANCE = ['administrateur', 'direction_generale', 'comptable'] as const;
// Décaissement : + directeur technique (règlement prestataire par Mobile Money).
const ROLES_PAYOUT = [...ROLES_FINANCE, 'directeur_technique'] as const;

interface RequeteAuth {
  user?: { userId?: string };
}

@Controller('ebilling')
export class EbillingController {
  constructor(private readonly service: EbillingService) {}

  // ── PAYIN : initier un encaissement ────────────────────────────────────

  @Post('payin')
  @Roles(...ROLES_FINANCE)
  @RequireModule('ebilling')
  creerPayin(@Body() body: CreatePayinDto, @Req() req: RequeteAuth) {
    return this.service.creerPayin(body, req.user?.userId);
  }

  // ── Callback PAYIN — public (appelé par E-Billing), authentifié par ?sig= ──

  @Public()
  @Post('callback/payin')
  async callbackPayin(@Body() body: unknown, @Query('sig') sig?: string) {
    await this.service.handlePayinCallback(body, sig);
    return { ok: true };
  }

  // ── PAYOUT : initier un décaissement ───────────────────────────────────

  @Post('payout')
  @Roles(...ROLES_PAYOUT)
  @RequireModule('ebilling', 'reglementPrestataire')
  creerPayout(@Body() body: CreatePayoutDto, @Req() req: RequeteAuth) {
    return this.service.creerPayout(body, req.user?.userId);
  }

  // ── Callback PAYOUT — public (appelé par SHAP), authentifié par ?sig= ───

  @Public()
  @Post('callback/payout')
  async callbackPayout(@Body() body: unknown, @Query('sig') sig?: string) {
    await this.service.handlePayoutCallback(body, sig);
    return { ok: true };
  }

  // ── Liste des transactions ──────────────────────────────────────────────

  @Get('transactions')
  @Roles(...ROLES_FINANCE)
  @RequireModule('ebilling')
  lister(
    @Query('type') type?: string,
    @Query('statut') statut?: string,
  ) {
    return this.service.lister(type, statut);
  }

  @Get('transactions/:reference')
  @Roles(...ROLES_FINANCE)
  @RequireModule('ebilling')
  detail(@Param('reference') reference: string) {
    return this.service.detail(reference);
  }
}
