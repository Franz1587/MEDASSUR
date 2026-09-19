import { Module } from "@nestjs/common";
import { RelevesPrestataireService } from "./releves-prestataire.service";

@Module({
  providers: [RelevesPrestataireService],
  exports: [RelevesPrestataireService],
})
export class RelevesPrestataireModule {}
