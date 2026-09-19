import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class UpdateDelegationModulesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modules: string[];
}
