import { IsArray, IsIn, IsString } from "class-validator";

export class GenererComptesMobileDto {
  @IsString()
  contratId: string;

  @IsArray()
  @IsString({ each: true })
  assureIds: string[];

  @IsIn(["WhatsApp", "SMS", "WhatsApp+SMS"])
  canal: "WhatsApp" | "SMS" | "WhatsApp+SMS";
}
