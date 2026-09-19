import { IsArray, IsString } from "class-validator";

export class UpdateRoleTemplateDto {
  @IsArray()
  @IsString({ each: true })
  modules: string[];
}
