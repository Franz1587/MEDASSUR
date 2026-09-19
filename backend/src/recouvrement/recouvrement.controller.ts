import { Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { RecouvrementService } from "./recouvrement.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("recouvrement")
@UseGuards(JwtAuthGuard)
export class RecouvrementController {
  constructor(private readonly service: RecouvrementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post("relancer-tout")
  relancerTous() {
    return this.service.relancerTous();
  }

  @Patch(":id/relancer")
  relancer(@Param("id") id: string) {
    return this.service.relancer(id);
  }

  @Patch(":id/resoudre")
  resoudre(@Param("id") id: string) {
    return this.service.resoudre(id);
  }
}
