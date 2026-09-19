import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ReglementComptableService } from "./reglement-comptable.service";
import { GenererLettreChequeDto } from "./dto/generer-lettre-cheque.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("reglement-comptable")
@UseGuards(JwtAuthGuard)
export class ReglementComptableController {
  constructor(private readonly service: ReglementComptableService) {}

  @Get()
  findAll(
    @Query("prestataireId") prestataireId?: string,
    @Query("banqueId") banqueId?: string,
    @Query("compagnieId") compagnieId?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
    @Query("reference") reference?: string,
  ) {
    return this.service.findAll({ prestataireId, banqueId, compagnieId, du, au, reference });
  }

  // Déclarée avant ":id" pour que Nest ne capture pas "eligibles" comme
  // une valeur de :id.
  @Get("eligibles")
  findEligibles(@Query("prestataireId") prestataireId: string, @Query("compagnieId") compagnieId?: string) {
    return this.service.findEligibles({ prestataireId, compagnieId });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post("generer")
  genererLettreCheque(@Body() dto: GenererLettreChequeDto) {
    return this.service.genererLettreCheque(dto);
  }
}
