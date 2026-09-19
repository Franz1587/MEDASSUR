import { IsString, MinLength } from "class-validator";

export class RejeterLigneFactureDto {
  @IsString()
  @MinLength(3)
  motifRejet: string;
}
