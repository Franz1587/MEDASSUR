import { IsIn, IsNumber, Min } from "class-validator";

export class UpsertTauxChangeDto {
  @IsIn(["EUR", "USD"])
  devise: string;

  @IsNumber()
  @Min(0.0001)
  tauxVersXaf: number;
}
