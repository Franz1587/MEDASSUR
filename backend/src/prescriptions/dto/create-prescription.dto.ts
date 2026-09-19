import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

// Ligne prescrite — médicament (complète la Feuille de Soins de la
// consultation d'origine) ou examen (bon d'examen) (2026-08) — voir demande
// utilisateur : "une e-ordonnance avec les quantités et la posologie...
// un bon examen".
export class CreatePrescriptionLigneDto {
  @IsIn(["Medicament", "Examen"])
  type: "Medicament" | "Examen";

  @IsOptional()
  @IsString()
  acteMedicalId?: string;

  @IsString()
  @IsNotEmpty()
  libelle: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantite?: number;

  // Posologie — pertinent seulement pour type = "Medicament".
  @IsOptional()
  @IsString()
  posologie?: string;
}

// Consultation en ligne du médecin prescripteur (2026-08) — voir demande
// utilisateur : "un écran dédié au médecin prescripteur... dossier
// clinique du patient, avec motif de consultation, code affection". La
// consultation elle-même (PriseEnCharge) doit déjà exister — voir demande
// utilisateur (correction) : "la consultation est l'origine de la feuille
// de soins, la prescription vient la compléter". `medecinId` n'est PAS
// saisi ici (2026-08, voir demande utilisateur : "le médecin doit avoir
// ses accès différents") — c'est TOUJOURS le médecin authentifié (voir
// PortailMedecinController, req.user.medecinId), jamais un choix du client.
export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  priseEnChargeId: string;

  // Motifs de consultation (2026-08) — voir demande utilisateur :
  // "l'application doit pouvoir faire remonter une liste des motifs, avec
  // la possibilité d'en ajouter plusieurs" — plusieurs motifs possibles.
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  motifsConsultation: string[];

  @IsOptional()
  @IsString()
  codeAffection?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionLigneDto)
  lignes: CreatePrescriptionLigneDto[];
}
