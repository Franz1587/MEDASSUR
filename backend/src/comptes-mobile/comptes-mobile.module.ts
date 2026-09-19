import { Module } from "@nestjs/common";
import { ComptesMobileController } from "./comptes-mobile.controller";
import { ComptesMobileService } from "./comptes-mobile.service";

@Module({
  controllers: [ComptesMobileController],
  providers: [ComptesMobileService],
})
export class ComptesMobileModule {}
