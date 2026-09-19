import { Module } from "@nestjs/common";
import { AgencesService } from "./agences.service";
import { AgencesController } from "./agences.controller";

@Module({
  providers: [AgencesService],
  controllers: [AgencesController],
  exports: [AgencesService],
})
export class AgencesModule {}
