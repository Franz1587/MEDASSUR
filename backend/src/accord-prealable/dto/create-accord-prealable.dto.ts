import { IsIn, IsString } from "class-validator";

export class CreateAccordPrealableDto {
  @IsString()
  assureId: string;

  @IsIn(["Hospitalisation", "Chirurgie", "EVASAN"])
  type: string;

  @IsString()
  description: string;

  @IsString()
  dateDemande: string;
}
