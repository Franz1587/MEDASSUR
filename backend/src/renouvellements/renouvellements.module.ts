import { Module } from "@nestjs/common";
import { RenouvellementsService } from "./renouvellements.service";
import { RenouvellementsController } from "./renouvellements.controller";
import { AvenantsModule } from "../avenants/avenants.module";
import { ResiliationsModule } from "../resiliations/resiliations.module";

@Module({
  imports: [AvenantsModule, ResiliationsModule],
  providers: [RenouvellementsService],
  controllers: [RenouvellementsController],
  exports: [RenouvellementsService],
})
export class RenouvellementsModule {}
