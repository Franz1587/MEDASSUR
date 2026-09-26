import { IsNumber, IsOptional, IsString } from "class-validator";

export class CreateCompagnieDto {
  @IsString()
  nom: string;

  @IsString()
  pays: string;

  // Déclinaison d'agence (2026-09) — voir schema.prisma
  // Compagnie.compagnieMereId : compagnie mère + agence, toujours ensemble
  // (vérifié par CompagniesService.verifierDeclinaison). Chaîne vide = aucune.
  @IsOptional()
  @IsString()
  compagnieMereId?: string;

  @IsOptional()
  @IsString()
  agenceId?: string;

  // Code interne de la compagnie — repris sur le Décompte de Remboursement
  // Maladie ("Compagnie <code> <nom>", voir schema.prisma Compagnie.code).
  @IsOptional()
  @IsString()
  code?: string;

  // Préfixe des numéros de police (2026-08) — distinct de `code` ci-dessus
  // (voir schema.prisma Compagnie.prefixeNumeroPolice).
  @IsOptional()
  @IsString()
  prefixeNumeroPolice?: string;

  // Code du courtier auprès de cette compagnie (2026-08) — voir Bordereau
  // de Production, colonne "Code Assuré".
  @IsOptional()
  @IsString()
  codeCourtier?: string;

  @IsOptional()
  @IsNumber()
  tauxCommissionMaladie?: number;

  @IsOptional()
  @IsNumber()
  tauxCommissionAssistance?: number;

  // Valeurs par défaut reprises pour pré-remplir une nouvelle Cotation
  // pour cette compagnie (voir CotationService) — voir schema.prisma.
  @IsOptional()
  @IsNumber()
  plafondFamilialDefaut?: number;

  @IsOptional()
  @IsNumber()
  limiteAgeAdulteDefaut?: number;

  @IsOptional()
  @IsNumber()
  limiteAgeEnfantDefaut?: number;

  // Papier en-tête / pied de page légal (2026-08) — repris sur les
  // documents imprimés sur le papier de la compagnie (ex. Facture
  // Production), jamais sur les documents MedAssur.
  @IsOptional() @IsString() raisonSociale?: string;
  @IsOptional() @IsString() capitalSocial?: string;
  @IsOptional() @IsString() rccm?: string;
  @IsOptional() @IsString() statistique?: string;
  @IsOptional() @IsString() adresseSiege?: string;
  @IsOptional() @IsString() boitePostale?: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() fax?: string;
  @IsOptional() @IsString() emailContact?: string;
  @IsOptional() @IsString() siteWeb?: string;

  // Coordonnées bancaires (2026-08) — reprises sur la Facture Production.
  @IsOptional() @IsString() banqueNom?: string;
  @IsOptional() @IsString() banqueNumeroCompte?: string;

  // Note de paiement par défaut (2026-08) — pré-remplit le formulaire
  // Facture Production, reste éditable au cas par cas.
  @IsOptional() @IsString() notePaiementDefaut?: string;

  // Pied de page légal — texte exact tel qu'imprimé sur le papier en-tête
  // réel, imprimé verbatim sur la Facture Production.
  @IsOptional() @IsString() piedDePageLegal?: string;
}
