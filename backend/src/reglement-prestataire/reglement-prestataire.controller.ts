import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ReglementPrestataireService } from "./reglement-prestataire.service";
import { GenererBordereauDto } from "./dto/generer-bordereau.dto";
import { PayerBordereauDto } from "./dto/payer-bordereau.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("reglement-prestataire")
@UseGuards(JwtAuthGuard)
export class ReglementPrestataireController {
  constructor(private readonly service: ReglementPrestataireService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post("generer")
  genererBordereau(@Body() dto: GenererBordereauDto) {
    return this.service.genererBordereau(dto);
  }

  @Patch(":id/valider")
  valider(@Param("id") id: string, @Body("montantValide") montantValide?: number) {
    return this.service.valider(id, montantValide);
  }

  @Patch(":id/rejeter")
  rejeter(@Param("id") id: string) {
    return this.service.rejeter(id);
  }

  @Patch(":id/payer")
  payer(@Param("id") id: string, @Body() dto: PayerBordereauDto) {
    return this.service.payer(id, dto);
  }
}
