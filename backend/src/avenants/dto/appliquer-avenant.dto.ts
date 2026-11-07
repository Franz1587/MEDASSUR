import { IsOptional, IsString } from "class-validator";

export class AppliquerAvenantDto {
  @IsOptional()
  @IsString()
  compagnieId?: string;
}
