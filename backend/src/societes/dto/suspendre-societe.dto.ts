import { IsOptional, IsString } from "class-validator";

export class SuspendreSocieteDto {
  @IsOptional()
  @IsString()
  motif?: string;
}
