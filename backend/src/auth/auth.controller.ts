import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AllowExternal, Public } from "./access.decorators";
import { AllowTemporaryPassword } from "./temporary-password.decorator";
import { TropDeTentativesException, ipClient } from "./login-throttle";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return await this.authService.login(dto.email, dto.password, ipClient(req));
    } catch (err) {
      if (err instanceof TropDeTentativesException) res.setHeader("Retry-After", String(err.retryAfterSeconds));
      throw err;
    }
  }

  // Voir AuthService.moi — resynchronise modules/droits sans redemander de
  // mot de passe (2026-09).
  @Get("me")
  @AllowExternal()
  @AllowTemporaryPassword()
  @UseGuards(JwtAuthGuard)
  moi(@Req() req: { user: { userId: string } }) {
    return this.authService.moi(req.user.userId);
  }

  // Consentement RGPD (2026-10) — voir AuthService.accepterConsentement.
  @Post("consentement")
  @AllowExternal()
  @UseGuards(JwtAuthGuard)
  accepterConsentement(@Req() req: { user: { userId: string } }) {
    return this.authService.accepterConsentement(req.user.userId);
  }
}
