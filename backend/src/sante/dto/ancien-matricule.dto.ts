import { IsString, MinLength } from "class-validator";

export class AncienMatriculeDto {
  @IsString()
  @MinLength(1)
  matricule: string;
}
