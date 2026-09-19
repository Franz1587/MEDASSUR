import { IsString } from "class-validator";

export class AnnulerRemboursementDto {
  @IsString()
  motif: string;
}
