import { Body, Controller, Delete, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ParametresEntrepriseService } from "./parametres-entreprise.service";
import { UpdateParametresEntrepriseDto } from "./dto/update-parametres-entreprise.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("parametres-entreprise")
@UseGuards(JwtAuthGuard)
export class ParametresEntrepriseController {
  constructor(private readonly parametresEntrepriseService: ParametresEntrepriseService) {}

  @Get()
  findOne() {
    return this.parametresEntrepriseService.findOne();
  }

  @Patch()
  update(@Body() dto: UpdateParametresEntrepriseDto) {
    return this.parametresEntrepriseService.update(dto);
  }

  // Logo (2026-09) — voir demande utilisateur, même patron que
  // CompagniesService.uploadLogo/deleteLogo.
  @Post("logo")
  @UseInterceptors(FileInterceptor("logo", { storage: memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    return this.parametresEntrepriseService.uploadLogoCourant(file);
  }

  @Delete("logo")
  deleteLogo() {
    return this.parametresEntrepriseService.deleteLogoCourant();
  }

  // Page de garde du rapport Statistiques (2026-09) — voir demande
  // utilisateur : "il faut seulement rendre possible la personnalisation de
  // la page de garde par client." Même patron que logo ci-dessus.
  @Post("page-garde-statistiques")
  @UseInterceptors(FileInterceptor("pageGarde", { storage: memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } }))
  uploadPageGardeStatistiques(@UploadedFile() file: Express.Multer.File) {
    return this.parametresEntrepriseService.uploadPageGardeStatistiquesCourante(file);
  }

  @Delete("page-garde-statistiques")
  deletePageGardeStatistiques() {
    return this.parametresEntrepriseService.deletePageGardeStatistiquesCourante();
  }
}
