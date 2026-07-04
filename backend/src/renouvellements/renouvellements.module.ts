import { Module } from "@nestjs/common";
import { RenouvellementsService } from "./renouvellements.service";
import { RenouvellementsController } from "./renouvellements.controller";

@Module({
  providers: [RenouvellementsService],
  controllers: [RenouvellementsController],
})
export class RenouvellementsModule {}
