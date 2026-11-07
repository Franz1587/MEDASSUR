import { ArrayMinSize, IsArray, IsString } from "class-validator";

export class CotationOffreDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  cotationIds: string[];
}
