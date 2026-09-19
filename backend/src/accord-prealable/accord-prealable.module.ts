import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SanteModule } from "../sante/sante.module";
import { AccordPrealableService } from "./accord-prealable.service";
import { AccordPrealableController } from "./accord-prealable.controller";

@Module({
  imports: [NotificationsModule, SanteModule],
  providers: [AccordPrealableService],
  controllers: [AccordPrealableController],
  exports: [AccordPrealableService],
})
export class AccordPrealableModule {}
