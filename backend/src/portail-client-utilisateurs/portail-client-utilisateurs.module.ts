import { Module } from "@nestjs/common";
import { PortailClientUtilisateursController } from "./portail-client-utilisateurs.controller";
import { PortailClientUtilisateursService } from "./portail-client-utilisateurs.service";

@Module({
  controllers: [PortailClientUtilisateursController],
  providers: [PortailClientUtilisateursService],
})
export class PortailClientUtilisateursModule {}
