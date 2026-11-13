import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequireModule } from "../auth/access.decorators";
import { IaAssistantService } from "./ia-assistant.service";
import { ChatDto } from "./dto/chat.dto";

@Controller("ia-assistant")
@UseGuards(JwtAuthGuard)
@RequireModule("ia")
export class IaAssistantController {
  constructor(private readonly service: IaAssistantService) {}

  @Post("chat")
  chat(@Body() dto: ChatDto) {
    return this.service.chat(dto);
  }
}
