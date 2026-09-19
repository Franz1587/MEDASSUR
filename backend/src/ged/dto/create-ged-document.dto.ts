import { IsArray, IsString } from "class-validator";

export class CreateGedDocumentDto {
  @IsString()
  nom: string;

  @IsString()
  type: string;

  @IsString()
  entiteLiee: string;

  @IsArray()
  @IsString({ each: true })
  tags: string[];
}
