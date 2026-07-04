import { IsIn, IsString } from "class-validator";

export class CreateCompagnieDto {
  @IsString()
  nom: string;

  @IsString()
  pays: string;

  @IsString()
  taux: string;

  @IsIn(["Premium", "Standard"])
  niveau: string;
}
