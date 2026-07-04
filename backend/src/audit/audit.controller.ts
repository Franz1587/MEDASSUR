import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("audit")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
