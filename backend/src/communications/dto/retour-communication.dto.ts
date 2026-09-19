import { IsString, MinLength } from "class-validator";

export class RetourCommunicationDto {
  @IsString()
  @MinLength(1)
  retour: string;
}
