import { IsNumber, Min } from "class-validator";

export class ConsommerDto {
  @IsNumber()
  @Min(0.01)
  montant: number;
}
