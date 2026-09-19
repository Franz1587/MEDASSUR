import { Module } from "@nestjs/common";
import { MouvementsService } from "./mouvements.service";

@Module({
  providers: [MouvementsService],
  exports: [MouvementsService],
})
export class MouvementsModule {}
