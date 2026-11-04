import { Module } from "@nestjs/common";
import { CommunicationsService } from "./communications.service";
import { CommunicationsController } from "./communications.controller";
import { ZavuWebhookController } from "./zavu-webhook.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { EmailService } from "./email.service";
import { EmailPollerService } from "./email-poller.service";

@Module({
  imports: [NotificationsModule],
  providers: [CommunicationsService, EmailService, EmailPollerService],
  controllers: [CommunicationsController, ZavuWebhookController],
  exports: [CommunicationsService, EmailService],
})
export class CommunicationsModule {}
