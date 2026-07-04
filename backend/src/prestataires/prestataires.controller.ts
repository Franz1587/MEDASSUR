import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { PrestatairesService } from "./prestataires.service";
import { CreatePrestataireDto } from "./dto/create-prestataire.dto";
import { UpdatePrestataireDto } from "./dto/update-prestataire.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("prestataires")
@UseGuards(JwtAuthGuard)
export class PrestatairesController {
  constructor(private readonly prestatairesService: PrestatairesService) {}

  @Get()
  findAll() {
    return this.prestatairesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.prestatairesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePrestataireDto) {
    return this.prestatairesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdatePrestataireDto) {
    return this.prestatairesService.update(id, dto);
  }

  @Patch(":id/suspendre")
  suspendre(@Param("id") id: string, @Body("motif") motif: string) {
    return this.prestatairesService.suspendre(id, motif);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.prestatairesService.remove(id);
  }
}
