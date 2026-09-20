import { Module } from "@nestjs/common";
import { GedService } from "./ged.service";
import { GedAnalyseService } from "./ged-analyse.service";
import { GedController } from "./ged.controller";
import { FacturesModule } from "../factures/factures.module";

@Module({
  imports: [FacturesModule],
  providers: [GedService, GedAnalyseService],
  controllers: [GedController],
})
export class GedModule {}
