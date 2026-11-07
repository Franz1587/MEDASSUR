import { IsBoolean } from "class-validator";

export class DerogationSaisieDto {
  @IsBoolean()
  autoriser: boolean;
}
