import { IsString } from "class-validator";

export class CreerReleveDto {
  @IsString()
  clientId: string;

  @IsString()
  periode: string;
}
