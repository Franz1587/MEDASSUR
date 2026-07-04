import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CotationService } from "./cotation.service";
import { CreateCotationDto } from "./dto/create-cotation.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("cotation")
@UseGuards(JwtAuthGuard)
export class CotationController {
  constructor(private readonly service: CotationService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** Prévisualise le tarif sans persister — utile pour un simulateur UI. */
  @Post("simuler")
  simuler(@Body() dto: CreateCotationDto) {
    return this.service.calculer(dto);
  }

  @Post()
  create(@Body() dto: CreateCotationDto) {
    return this.service.create(dto);
  }
}
