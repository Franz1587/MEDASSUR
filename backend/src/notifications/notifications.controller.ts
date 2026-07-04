import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() body: { destinataireType: string; destinataireId: string; message: string }) {
    return this.service.create(body.destinataireType, body.destinataireId, body.message);
  }

  @Patch(":id/lue")
  marquerLue(@Param("id") id: string) {
    return this.service.marquerLue(id);
  }
}
