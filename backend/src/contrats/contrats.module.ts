import { Module } from "@nestjs/common";
import { ContratsService } from "./contrats.service";
import { ContratsController } from "./contrats.controller";
import { MouvementsModule } from "../mouvements/mouvements.module";
import { CommunicationsModule } from "../communications/communications.module";
import { CompagniesModule } from "../compagnies/compagnies.module";

@Module({
  imports: [MouvementsModule, CommunicationsModule, CompagniesModule],
  providers: [ContratsService],
  controllers: [ContratsController],
  exports: [ContratsService],
})
export class ContratsModule {}
