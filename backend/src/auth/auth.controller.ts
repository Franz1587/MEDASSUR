import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // Voir AuthService.moi — resynchronise modules/droits sans redemander de
  // mot de passe (2026-09).
  @Get("me")
  @UseGuards(JwtAuthGuard)
  moi(@Req() req: { user: { userId: string } }) {
    return this.authService.moi(req.user.userId);
  }
}
