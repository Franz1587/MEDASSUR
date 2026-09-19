import { IsArray, IsString } from "class-validator";

export class UpdateModulesPortailDto {
  @IsArray()
  @IsString({ each: true })
  modules!: string[];
}
