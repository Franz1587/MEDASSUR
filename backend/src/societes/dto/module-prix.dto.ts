import { IsIn, IsNumber, IsString, Min, MinLength } from "class-validator";

export class UpsertModulePrixDto {
  @IsString()
  @MinLength(1)
  module: string;

  @IsNumber()
  @Min(0)
  prix: number;

  @IsIn(["EUR", "USD"])
  devise: string;
}
