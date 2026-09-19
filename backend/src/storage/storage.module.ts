import { Global, Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

// Global (2026-09) — même patron que PrismaModule : StorageService doit
// être injectable depuis N'IMPORTE QUEL module (18 services y accèdent à
// terme, voir mémoire "project-deploiement-supabase") sans devoir
// réimporter ce module partout.
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
