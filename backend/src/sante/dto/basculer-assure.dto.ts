import { IsBoolean, IsString } from "class-validator";

export class BasculerAssureDto {
  @IsString()
  contratDestinationId: string;

  @IsBoolean()
  avecFamille: boolean;

  @IsString()
  dateEffet: string;
}
