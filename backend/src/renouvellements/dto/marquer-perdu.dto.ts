import { IsOptional, IsString } from "class-validator";

export class MarquerPerduDto {
  @IsOptional()
  @IsString()
  initiateur?: string;
}
