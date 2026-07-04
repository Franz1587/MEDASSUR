import { Module } from "@nestjs/common";
import { AppelOffresService } from "./appel-offres.service";
import { AppelOffresController } from "./appel-offres.controller";

@Module({
  providers: [AppelOffresService],
  controllers: [AppelOffresController],
})
export class AppelOffresModule {}
