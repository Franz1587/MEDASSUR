import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { FactureProductionService } from "./facture-production.service";
import { CreateFactureProductionDto } from "./dto/create-facture-production.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("facture-production")
@UseGuards(JwtAuthGuard)
export class FactureProductionController {
  constructor(private readonly service: FactureProductionService) {}

  @Get()
  findAll(
    @Query("compagnieId") compagnieId?: string,
    @Query("clientId") clientId?: string,
    @Query("du") du?: string,
    @Query("au") au?: string,
    @Query("reference") reference?: string,
  ) {
    return this.service.findAll({ compagnieId, clientId, du, au, reference });
  }

  // Déclarées AVANT ":id" — sinon NestJS route "mouvements-non-factures"/
  // "objets-suggeres" vers findOne(":id").
  @Get("mouvements-non-factures")
  mouvementsNonFactures(@Query("clientId") clientId: string, @Query("compagnieId") compagnieId?: string) {
    return this.service.mouvementsNonFactures(clientId, compagnieId);
  }

  @Get("objets-suggeres")
  objetsSuggeres() {
    return this.service.objetsSuggeres();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateFactureProductionDto) {
    return this.service.create(dto);
  }
}
