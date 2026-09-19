import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsString, MinLength } from "class-validator";
import { UsersService } from "./users.service";

class SignerDto {
  // Image PNG encodée en data URL ("data:image/png;base64,...."), exportée
  // depuis le <canvas> de la page de signature (voir src/features/signer/).
  @IsString()
  @MinLength(50)
  imageDataUrl: string;
}

// PUBLIC — SANS authentification (2026-09) — voir demande utilisateur :
// "on scanne [le QR code]... on signe et on valide". Le téléphone qui
// scanne n'est jamais connecté à l'application sur cet appareil ; seul le
// jeton (opaque, à usage unique, expirant après 10 min — voir
// UsersService.genererJetonSignature) identifie le compte à signer. Ne
// JAMAIS exposer autre chose que le nom du titulaire (voir infoJetonSignature)
// — aucune autre donnée du compte n'est accessible depuis cette route.
@Controller("signer")
export class SignaturePubliqueController {
  constructor(private readonly service: UsersService) {}

  @Get(":token")
  info(@Param("token") token: string) {
    return this.service.infoJetonSignature(token);
  }

  @Post(":token")
  async signer(@Param("token") token: string, @Body() dto: SignerDto) {
    const matches = dto.imageDataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!matches) throw new BadRequestException("Format d'image invalide — attendu un PNG en data URL.");
    const buffer = Buffer.from(matches[1], "base64");
    await this.service.signerAvecJeton(token, buffer);
    return { ok: true };
  }
}
