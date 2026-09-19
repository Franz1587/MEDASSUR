import { Module } from "@nestjs/common";
import { SanteService } from "./sante.service";
import { SanteController } from "./sante.controller";
import { MouvementsModule } from "../mouvements/mouvements.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [MouvementsModule, NotificationsModule],
  providers: [SanteService],
  controllers: [SanteController],
  exports: [SanteService],
})
export class SanteModule {}
