import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class MessageHistoriqueArianaDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant";

  @IsString()
  content: string;
}

// Chat ARIANA de l'écran Appel d'offres (voir src/services/ai.service.ts chatAriana).
export class ChatArianaDto {
  @IsString()
  @MaxLength(20000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MessageHistoriqueArianaDto)
  historique?: MessageHistoriqueArianaDto[];
}
