import { IsOptional, IsString } from "class-validator";

export class CreateAgenceDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  code?: string;
}
