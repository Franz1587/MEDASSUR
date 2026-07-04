import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { FraudeService } from "./fraude.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("fraude")
@UseGuards(JwtAuthGuard)
export class FraudeController {
  constructor(private readonly service: FraudeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post("evaluer/assure/:assureId")
  evaluerAssure(@Param("assureId") assureId: string) {
    return this.service.evaluerAssure(assureId);
  }
}
