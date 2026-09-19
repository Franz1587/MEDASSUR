import { Module } from "@nestjs/common";
import { CommunicationsService } from "./communications.service";
import { CommunicationsController } from "./communications.controller";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  providers: [CommunicationsService],
  controllers: [CommunicationsController],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
