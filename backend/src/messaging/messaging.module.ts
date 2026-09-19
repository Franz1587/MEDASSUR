import { Global, Module } from "@nestjs/common";
import { ParametresEntrepriseModule } from "../parametres-entreprise/parametres-entreprise.module";
import { MessagingService } from "./messaging.service";

// @Global (2026-09) — même principe que StorageModule : de nombreux
// services métier dispersés (accord préalable, remboursements, prises en
// charge, règlement prestataire...) ont besoin d'envoyer un SMS/WhatsApp
// ponctuellement, sans justifier un import explicite du module dans chacun.
@Global()
@Module({
  imports: [ParametresEntrepriseModule],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
