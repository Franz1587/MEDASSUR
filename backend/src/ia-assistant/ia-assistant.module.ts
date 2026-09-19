import { Module } from "@nestjs/common";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";
import { IaAssistantController } from "./ia-assistant.controller";
import { IaAssistantService } from "./ia-assistant.service";

@Module({
  imports: [ParametresEntrepriseModule],
  controllers: [IaAssistantController],
  providers: [IaAssistantService],
})
export class IaAssistantModule {}
