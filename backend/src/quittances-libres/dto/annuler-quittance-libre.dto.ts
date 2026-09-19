import { IsString, MinLength } from "class-validator";

export class AnnulerQuittanceLibreDto {
  @IsString()
  @MinLength(3)
  motif: string;
}
