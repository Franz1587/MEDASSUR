import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { PushNotificationsService } from "./push-notifications.service";

@Module({
  providers: [NotificationsService, PushNotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService, PushNotificationsService],
})
export class NotificationsModule {}
