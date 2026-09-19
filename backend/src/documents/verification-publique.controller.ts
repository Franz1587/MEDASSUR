import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { DocumentSignatureService } from "./document-signature.service";

// PUBLIC — SANS authentification (2026-09) — voir demande utilisateur :
// "une signature électronique unique (QR code) pour chaque document créé
// ou édité dans l'application... une authentification infaillible de
// chaque prestation faite". Quiconque scanne le QR imprimé sur un document
// (jamais connecté à l'application sur cet appareil) doit pouvoir vérifier
// son authenticité et son statut actuel sans compte — même convention que
// SignaturePubliqueController (`/signer/:token`), aucun JwtAuthGuard ici.
@Controller("verification")
export class VerificationPubliqueController {
  constructor(private readonly signatures: DocumentSignatureService) {}

  @Get(":id")
  async verifier(@Param("id") id: string) {
    const signature = await this.signatures.verifier(id);
    if (!signature) throw new NotFoundException("Ce document n'a pas pu être authentifié — référence inconnue.");
    return signature;
  }
}
