import { IsOptional, IsString } from "class-validator";

export class RetirerAssureDto {
  @IsString()
  dateEffet: string;

  @IsOptional()
  @IsString()
  motif?: string;
}
