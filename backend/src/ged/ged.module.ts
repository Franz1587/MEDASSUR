import { Module } from "@nestjs/common";
import { GedService } from "./ged.service";
import { GedAnalyseService } from "./ged-analyse.service";
import { GedCronService } from "./ged-cron.service";
import { GedController } from "./ged.controller";
import { FacturesModule } from "../factures/factures.module";

@Module({
  imports: [FacturesModule],
  providers: [GedService, GedAnalyseService, GedCronService],
  controllers: [GedController],
  exports: [GedService, GedAnalyseService],
})
export class GedModule {}
