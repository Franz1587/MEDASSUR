import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { MouvementsModule } from "../mouvements/mouvements.module";
import { DemandesClientService } from "./demandes-client.service";
import { DemandesClientController } from "./demandes-client.controller";

@Module({
  imports: [NotificationsModule, MouvementsModule],
  providers: [DemandesClientService],
  controllers: [DemandesClientController],
})
export class DemandesClientModule {}
