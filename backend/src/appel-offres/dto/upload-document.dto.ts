import { IsIn, IsOptional, IsString } from "class-validator";

export class UploadAppelOffresDocumentDto {
  @IsIn(["Cahier des charges", "Offre compagnie", "Autre"])
  type: string;

  @IsOptional()
  @IsString()
  compagnieId?: string;
}
