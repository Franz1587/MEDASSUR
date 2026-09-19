import { Module } from "@nestjs/common";
import { AvenantsService } from "./avenants.service";
import { AvenantsController } from "./avenants.controller";

@Module({
  providers: [AvenantsService],
  controllers: [AvenantsController],
  exports: [AvenantsService],
})
export class AvenantsModule {}
