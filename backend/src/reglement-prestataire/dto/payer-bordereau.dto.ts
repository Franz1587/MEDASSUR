import { IsString } from "class-validator";

export class PayerBordereauDto {
  @IsString()
  referenceVirement: string;
}
