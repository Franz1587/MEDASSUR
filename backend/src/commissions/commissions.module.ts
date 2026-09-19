import { Module } from "@nestjs/common";
import { CommissionsService } from "./commissions.service";
import { CommissionsController } from "./commissions.controller";
import { BordereauxModule } from "../bordereaux/bordereaux.module";

@Module({
  imports: [BordereauxModule],
  providers: [CommissionsService],
  controllers: [CommissionsController],
})
export class CommissionsModule {}
