import { ArrayMinSize, IsArray, IsOptional, IsString } from "class-validator";

export class FusionPrestatairesDto {
  @IsString()
  conserverId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  absorberIds: string[];

  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  ville?: string;
}
