import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { TYPES_PRESTATION } from "../../sante/dto/create-facture-ligne.dto";

// Ajout d'une ligne à une facture déjà saisie (2026-08) — voir demande
// utilisateur : "il faut un vrai formulaire de saisie de facture" — le
// bénéficiaire reste celui de la facture (déduit de ses lignes existantes
// côté service, jamais resaisi ici) ; seuls le type, la date et l'acte
// varient d'une ligne à l'autre.
export class AjouterLignePrestationDto {
  @IsIn(TYPES_PRESTATION)
  typePrestation: string;

  @IsString()
  datePrestation: string;

  @IsOptional() @IsString() acteMedicalId?: string;
  @IsOptional() @IsString() lettreCleCode?: string;
  @IsOptional() @IsNumber() coefficient?: number;
  @IsNumber() @Min(0) montant: number;
  @IsOptional() @IsNumber() @Min(1) quantite?: number;

  // Code affection CNAMGS + nature de l'affection (2026-08) — voir demande
  // utilisateur : "on doit renseigner le code d'affection pour chaque
  // ligne de saisie de la facture" — obligatoire ici aussi (SanteService.
  // creerLigneFacture, exigerAffection par défaut), jamais affiché sur le
  // Décompte remis au tiers.
  @IsIn(["AffectionCourante", "AffectionLongue"])
  natureMaladie: string;

  @IsOptional() @IsString()
  codeAffection?: string;

  // Médecin assigné par l'accueil pour une Consultation (2026-09) — voir
  // demande utilisateur : "au niveau de l'accueil, le médecin doit avoir
  // été lié à la prestation consultation qui doit se faire".
  @IsOptional() @IsString() medecinId?: string;
}
