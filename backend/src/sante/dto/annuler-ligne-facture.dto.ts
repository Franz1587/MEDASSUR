import { IsString, MinLength } from "class-validator";

export class AnnulerLigneFactureDto {
  @IsString()
  @MinLength(3)
  motif: string;
}
