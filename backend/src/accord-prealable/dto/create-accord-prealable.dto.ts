import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";

// Ligne d'une demande de prise en charge (2026-08) — une prise en charge
// peut couvrir plusieurs actes liés, comme une facture (voir demande
// utilisateur). plafondReference est calculé côté frontend (voir
// montantDevisPourActe) et transmis figé, jamais recalculé côté serveur —
// même principe que PriseEnCharge.baseRemboursement.
export class AccordPrealableLigneDto {
  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  @IsOptional()
  @IsString()
  lettreCleCode?: string;

  @IsOptional()
  @IsNumber()
  coefficient?: number;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  plafondReference: number;

  // Frais réels annoncés par le prestataire sur son devis, ligne par ligne
  // — peut dépasser plafondReference, l'excédent restant à la charge du
  // bénéficiaire (voir demande utilisateur).
  @IsNumber()
  @Min(0)
  montantDevis: number;
}

export class CreateAccordPrealableDto {
  @IsString()
  assureId: string;

  // Rubrique de garantie (2026-08) — voir demande utilisateur : "tu ne fais
  // toujours pas remonter toutes les rubriques de garanties." Texte libre,
  // jamais un allowlist figé : la saisie Agent doit pouvoir couvrir
  // n'importe quelle rubrique du VRAI tableau de garanties du contrat de
  // l'assuré choisi (Garantie.categorie), au même titre que le Portail
  // Assuré (CreateAccordPrealableMembreDto, même principe — "un allowlist
  // fixe désynchronise dès qu'un produit ajoute/renomme une rubrique").
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  description: string;

  @IsString()
  dateDemande: string;

  // Toute entente préalable se rapporte à un prestataire (clinique, hôpital,
  // cabinet médical, dentiste, ophtalmologue, laboratoire, opticien…) —
  // texte libre toujours renseigné, lien optionnel vers le catalogue.
  @IsString()
  prestataire: string;

  @IsOptional()
  @IsString()
  prestataireId?: string;

  // Pièces justificatives obligatoires pour instruire une demande —
  // l'accord dépend de leur présentation (voir schema.prisma).
  @IsOptional() @IsString() prescriptionRef?: string;
  @IsOptional() @IsNumber() @Min(0) montantDevis?: number;

  @IsOptional()
  @IsIn(["Portail Prestataire", "Portail Assuré", "Agent"])
  origine?: string;

  // Lignes d'actes (2026-08) — voir AccordPrealableLigneDto. Facultatif
  // pour compatibilité (un appelant qui ne fournit pas de lignes garde
  // l'ancien comportement, description/montantDevis directs) ; la saisie
  // via l'écran Prise en charge transmet toujours au moins une ligne.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AccordPrealableLigneDto)
  lignes?: AccordPrealableLigneDto[];
}
