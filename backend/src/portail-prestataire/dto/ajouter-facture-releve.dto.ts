import { IsString } from "class-validator";

export class AjouterFactureReleveDto {
  @IsString()
  factureId: string;
}
