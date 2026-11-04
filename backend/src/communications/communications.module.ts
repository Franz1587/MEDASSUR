import { Module } from "@nestjs/common";
import { CommunicationsService } from "./communications.service";
import { CommunicationsController } from "./communications.controller";
import { ZavuWebhookController } from "./zavu-webhook.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { EmailService } from "./email.service";

@Module({
  imports: [NotificationsModule],
  providers: [CommunicationsService, EmailService],
  controllers: [CommunicationsController, ZavuWebhookController],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
