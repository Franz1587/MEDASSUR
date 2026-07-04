import { Controller, Get, UseGuards } from "@nestjs/common";
import { IardService } from "./iard.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("iard")
@UseGuards(JwtAuthGuard)
export class IardController {
  constructor(private readonly service: IardService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
