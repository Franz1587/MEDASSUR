import { IsString } from "class-validator";

export class AjouterNumeroDto {
  @IsString()
  numero: string;
}
