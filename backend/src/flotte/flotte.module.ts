import { Module } from "@nestjs/common";
import { FlotteService } from "./flotte.service";
import { FlotteController } from "./flotte.controller";

@Module({
  providers: [FlotteService],
  controllers: [FlotteController],
})
export class FlotteModule {}
