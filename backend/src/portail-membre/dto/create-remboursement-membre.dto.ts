import { IsNumber, IsOptional, IsString, Min } from "class-validator";

// Soumission libre-service d'une demande de remboursement (2026-08) — voir
// demande utilisateur : "écran externe dédié à l'assuré principal". Sous-
// ensemble de CreatePriseEnChargeDto : assureId et modePaiement sont TOUJOURS
// forcés côté serveur (PortailMembreController), jamais transmis par le
// client, pour qu'un assuré ne puisse jamais soumettre au nom d'un autre.
//
// prestataire/type/montant facultatifs (2026-08) — voir demande utilisateur :
// "en ce qui concerne le remboursement seul les pièces doivent être
// jointes... rendre facultatif, la date et l'ajout des pièces peuvent être
// suffisantes pour faire la demande". Le gestionnaire complète/corrige ces
// champs à réception des pièces jointes (voir PortailMembreController.creerRemboursement,
// qui applique des valeurs de repli neutres avant d'appeler SanteService.createPriseEnCharge).
export class CreateRemboursementMembreDto {
  @IsOptional()
  @IsString()
  prestataire?: string;

  @IsOptional()
  @IsString()
  prestataireId?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  montant?: number;

  @IsString()
  date: string;

  // Lien vers le catalogue ActeMedical (2026-08) — voir demande utilisateur :
  // "on doit sélectionner ou rechercher... les actes".
  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  // Bénéficiaire réel des frais engagés (2026-09) — voir demande
  // utilisateur : "on puisse clairement indiquer pour qui dans la famille
  // on a engagé les frais, l'assuré principal ou un ayant droit". Facultatif
  // (repli sur soi-même côté contrôleur) — jamais un id de tiers hors
  // famille : vérifié dans PortailMembreController.creerRemboursement avec
  // la MÊME règle que l'accès à "Ma carte" (cible.familleId === son propre
  // assureSanteId).
  @IsOptional()
  @IsString()
  beneficiaireId?: string;
}
