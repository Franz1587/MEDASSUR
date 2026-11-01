import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export const TYPES_RENDEZ_VOUS = ["Consultation", "Contrôle", "Examen"] as const;
export const STATUTS_PROFESSIONNEL = ["Confirmé", "Refusé", "Honoré", "Absent"] as const;
export const TYPES_MESURE = ["Tension", "Glycémie", "Poids", "Température", "Fréquence cardiaque", "Saturation", "Autre"] as const;

export class CreerRendezVousDto {
  @IsString()
  assureId: string;

  @IsOptional()
  @IsString()
  medecinId?: string;

  @IsOptional()
  @IsString()
  prestataireId?: string;

  @IsIn(TYPES_RENDEZ_VOUS)
  type: (typeof TYPES_RENDEZ_VOUS)[number];

  @IsOptional()
  @IsString()
  specialite?: string;

  @IsOptional()
  @IsString()
  motif?: string;

  @IsDateString()
  dateHeure: string;
}

// Réponse du professionnel : confirmation (éventuellement à un autre
// horaire), refus motivé, ou issue du rendez-vous (honoré / absent).
export class RepondreRendezVousDto {
  @IsIn(STATUTS_PROFESSIONNEL)
  statut: (typeof STATUTS_PROFESSIONNEL)[number];

  @IsOptional()
  @IsString()
  reponse?: string;

  @IsOptional()
  @IsDateString()
  dateHeure?: string;

  // Établissement seulement : affecte (ou réaffecte) un de ses médecins.
  @IsOptional()
  @IsString()
  medecinId?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  dureeMinutes?: number;
}

export class AjouterMesureDto {
  // Facultatif côté médecin : l'assuré vient de l'adresse de la route.
  @IsOptional()
  @IsString()
  assureId: string;

  @IsIn(TYPES_MESURE)
  type: (typeof TYPES_MESURE)[number];

  @IsString()
  valeur: string;

  @IsOptional()
  @IsString()
  unite?: string;

  @IsOptional()
  @IsDateString()
  dateMesure?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
