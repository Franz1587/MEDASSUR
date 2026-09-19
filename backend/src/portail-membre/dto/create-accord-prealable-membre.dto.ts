import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { AccordPrealableLigneDto } from "../../accord-prealable/dto/create-accord-prealable.dto";

// Soumission libre-service d'une demande de prise en charge (2026-08) — voir
// demande utilisateur. Sous-ensemble de CreateAccordPrealableDto : assureId
// et origine sont TOUJOURS forcés côté serveur (PortailMembreController).
// `lignes` (2026-08) — voir demande utilisateur : "on doit sélectionner ou
// rechercher le prestataire et les actes... les données doivent remonter
// depuis les données saisies côté assurance" — un ou plusieurs actes
// choisis dans le VRAI catalogue ActeMedical (GET /actes-medicaux, déjà
// ouvert à tout compte authentifié), mêmes lignes que la saisie interne
// (AccordPrealableService.create dérive description/montantDevis DEPUIS
// lignes quand elles sont fournies — rien à recalculer ici).
export class CreateAccordPrealableMembreDto {
  // Groupe de garantie (2026-08) — voir demande utilisateur : "il faut
  // faire remonter les familles de garanties... groupe de garantie qui
  // sont dans le tableau de garantie". La valeur vient désormais du VRAI
  // tableau de garanties du contrat de l'assuré (Garantie.categorie via
  // GET /portail-membre/garanties), jamais d'une liste figée ici — un
  // allowlist fixe ("Hospitalisation"/"Chirurgie"/"EVASAN"...) désynchronise
  // dès qu'un produit ajoute/renomme une rubrique.
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  dateDemande: string;

  @IsString()
  prestataire: string;

  @IsOptional()
  @IsString()
  prestataireId?: string;

  @IsOptional() @IsNumber() @Min(0) montantDevis?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AccordPrealableLigneDto)
  lignes?: AccordPrealableLigneDto[];
}
