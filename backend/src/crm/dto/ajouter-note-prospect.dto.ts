import { IsString, MinLength } from "class-validator";

export class AjouterNoteProspectDto {
  @IsString()
  @MinLength(2)
  description: string;
}
