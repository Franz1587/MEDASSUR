import { IsString, MinLength } from "class-validator";

export class AnnulerFactureDto {
  @IsString()
  @MinLength(3)
  motif: string;
}
