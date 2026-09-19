import { Body, Controller, Get, Patch, Query, UseGuards } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReverserCommissionDto } from "./dto/reverser-commission.dto";

@Controller("commissions")
@UseGuards(JwtAuthGuard)
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get()
  findAll(@Query("du") du?: string, @Query("au") au?: string) {
    return this.service.findAll(du, au);
  }

  @Patch("reverser")
  reverser(@Body() dto: ReverserCommissionDto) {
    return this.service.reverser(dto.compagnieId, dto.periode);
  }
}
