import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { Request } from "express";
import * as QRCode from "qrcode";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UpdateMoiDto } from "./dto/update-moi.dto";
import { ChangerMotDePasseDto } from "./dto/changer-mot-de-passe.dto";

type MoiRequest = Request & { user: { userId: string } };

// Libre-service (2026-09) — voir demande utilisateur : "le médecin puisse
// dans son compte mettre sa signature". Distinct de UsersController
// (réservé aux administrateurs qui gèrent le compte D'AUTRUI) : ici
// N'IMPORTE QUEL utilisateur authentifié, quel que soit son rôle (médecin,
// agent d'une société comme LA RUCHE EXCELLENCE, assuré, souscripteur...),
// gère SA PROPRE signature — jamais celle d'un autre compte, l'id vient
// toujours du token JWT, jamais d'un paramètre de route.
@Controller("users/moi")
@UseGuards(JwtAuthGuard)
export class UsersMoiController {
  constructor(private readonly service: UsersService) {}

  // Fraîcheur après upload (2026-09) — le JWT/login ne porte pas photo ni
  // signature (évite de le regonfler pour un champ qui change rarement) ;
  // cette route donne au frontend un moyen simple de relire l'état courant
  // sans devoir se reconnecter.
  @Get()
  moi(@Req() req: MoiRequest) {
    return this.service.findOne(req.user.userId);
  }

  // "Mon profil" (2026-09) — voir demande utilisateur : "un vrai formulaire
  // Mon profil... c'est là qu'il pourra [modifier ses infos]... il faut
  // ajouter un bouton pour enregistrer". Jamais email/roleId — voir
  // UpdateMoiDto.
  @Patch()
  modifierMonProfil(@Body() dto: UpdateMoiDto, @Req() req: MoiRequest) {
    return this.service.update(req.user.userId, dto);
  }

  @Patch("mot-de-passe")
  changerMotDePasse(@Body() dto: ChangerMotDePasseDto, @Req() req: MoiRequest) {
    return this.service.changerMotDePasse(req.user.userId, dto);
  }

  @Post("signature")
  @UseInterceptors(FileInterceptor("signature", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadSignature(@UploadedFile() file: Express.Multer.File, @Req() req: MoiRequest) {
    return this.service.uploadSignature(req.user.userId, file);
  }

  @Delete("signature")
  deleteSignature(@Req() req: MoiRequest) {
    return this.service.deleteSignature(req.user.userId);
  }

  // QR code de signature (2026-09) — voir demande utilisateur :
  // "l'application devra générer un QR code qui sera scanné". Rendu en
  // data URL PNG directement ici (même bibliothèque `qrcode` que
  // DocumentsService, déjà utilisée côté backend) — le frontend n'a besoin
  // d'aucune dépendance QR pour l'afficher, juste un <img src=... />.
  @Post("signature/qr")
  async genererQrSignature(@Req() req: MoiRequest) {
    const { token, expiresAt } = await this.service.genererJetonSignature(req.user.userId);
    const url = `${process.env.APP_URL ?? "https://medassur.cloud"}/signer/${token}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    return { token, url, qrDataUrl, expiresAt };
  }

  // Statut du jeton (2026-09) — l'écran desktop qui a affiché le QR
  // interroge cette route en polling pour savoir dès que le téléphone a
  // validé LA signature (vérifie CE jeton précis, jamais un simple "a une
  // signature en compte" — sinon un utilisateur qui en REMPLACE une déjà
  // existante verrait le statut "signé" avant même d'avoir scanné).
  @Get("signature/qr/:token/statut")
  statutJeton(@Param("token") token: string) {
    return this.service.statutJetonSignature(token);
  }
}
