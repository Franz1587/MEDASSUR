import { Module } from "@nestjs/common";
import { ParametresEntrepriseService } from "./parametres-entreprise.service";
import { ParametresEntrepriseController } from "./parametres-entreprise.controller";

@Module({
  providers: [ParametresEntrepriseService],
  controllers: [ParametresEntrepriseController],
  exports: [ParametresEntrepriseService],
})
export class ParametresEntrepriseModule {}
