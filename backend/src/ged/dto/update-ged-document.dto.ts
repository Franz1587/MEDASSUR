import { IsOptional, IsString } from "class-validator";

// Seuls champs modifiables d'un document GED depuis l'écran (voir
// src/services/ged.service.ts updateDocument). prestataireId peut valoir
// null pour détacher le prestataire ; dates au format JJ/MM/AAAA.
export class UpdateGedDocumentDto {
  @IsOptional()
  @IsString()
  prestataireId?: string | null;

  @IsOptional()
  @IsString()
  entiteLiee?: string;

  @IsOptional()
  @IsString()
  dateCachet?: string | null;
}
