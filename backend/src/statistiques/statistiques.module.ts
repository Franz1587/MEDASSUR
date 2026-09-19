import { Module } from "@nestjs/common";
import { StatistiquesService } from "./statistiques.service";
import { StatistiquesController } from "./statistiques.controller";

@Module({
  providers: [StatistiquesService],
  controllers: [StatistiquesController],
  exports: [StatistiquesService],
})
export class StatistiquesModule {}
