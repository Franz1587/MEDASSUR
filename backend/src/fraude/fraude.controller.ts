import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { FraudeService } from "./fraude.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireModule } from "../auth/access.decorators";
import { Roles } from "../auth/roles.decorator";
import { ROLES_SANTE } from "../auth/access-roles";

@Controller("fraude")
@UseGuards(JwtAuthGuard)
@RequireModule("fraude")
export class FraudeController {
  constructor(private readonly service: FraudeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(...ROLES_SANTE)
  @Post("evaluer/assure/:assureId")
  evaluerAssure(@Param("assureId") assureId: string) {
    return this.service.evaluerAssure(assureId);
  }
}
