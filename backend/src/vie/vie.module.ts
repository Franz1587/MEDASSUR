import { Module } from "@nestjs/common";
import { VieService } from "./vie.service";
import { VieController } from "./vie.controller";

@Module({
  providers: [VieService],
  controllers: [VieController],
})
export class VieModule {}
