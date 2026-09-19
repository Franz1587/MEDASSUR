import { Module } from "@nestjs/common";
import { ResiliationsService } from "./resiliations.service";
import { ResiliationsController } from "./resiliations.controller";
import { AvenantsModule } from "../avenants/avenants.module";

@Module({
  imports: [AvenantsModule],
  providers: [ResiliationsService],
  controllers: [ResiliationsController],
  exports: [ResiliationsService],
})
export class ResiliationsModule {}
