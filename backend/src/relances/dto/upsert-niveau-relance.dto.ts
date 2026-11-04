import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpsertNiveauRelanceDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsInt()
  @Min(1)
  ordre!: number;

  @IsInt()
  @Min(1)
  joursAvantEcheance!: number;

  @IsString()
  objet!: string;

  @IsString()
  corps!: string;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;
}
