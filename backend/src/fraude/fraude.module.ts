import { Module } from "@nestjs/common";
import { FraudeService } from "./fraude.service";
import { FraudeController } from "./fraude.controller";

@Module({
  providers: [FraudeService],
  controllers: [FraudeController],
})
export class FraudeModule {}
