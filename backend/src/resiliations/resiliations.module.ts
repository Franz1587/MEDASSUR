import { Module } from "@nestjs/common";
import { ResiliationsService } from "./resiliations.service";
import { ResiliationsController } from "./resiliations.controller";

@Module({
  providers: [ResiliationsService],
  controllers: [ResiliationsController],
})
export class ResiliationsModule {}
