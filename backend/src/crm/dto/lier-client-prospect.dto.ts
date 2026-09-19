import { IsString } from "class-validator";

export class LierClientProspectDto {
  @IsString()
  clientId: string;
}
