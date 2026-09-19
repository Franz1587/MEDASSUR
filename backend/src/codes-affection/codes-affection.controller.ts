import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

// Codification des affections CNAMGS (2026-08) — voir demande utilisateur :
// "implémenter dans la base de données les codes d'affection". Catalogue
// de référence, ouvert à tout compte authentifié (même convention que
// /actes-medicaux) — alimente le Combobox "Code affection" de l'écran
// Médecin prescripteur.
@Controller("codes-affection")
@UseGuards(JwtAuthGuard)
export class CodesAffectionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.codeAffection.findMany({ orderBy: [{ chapitre: "asc" }, { code: "asc" }] });
  }
}
