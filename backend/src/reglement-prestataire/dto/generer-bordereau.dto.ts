import { IsString } from "class-validator";

export class GenererBordereauDto {
  @IsString()
  prestataireId: string;

  @IsString()
  periode: string;
}
