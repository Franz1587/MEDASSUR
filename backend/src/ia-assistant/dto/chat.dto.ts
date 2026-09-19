import { IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class MessageHistoriqueDto {
  @IsIn(["user", "assistant"])
  role: "user" | "assistant";

  @IsString()
  content: string;
}

export class ChatDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageHistoriqueDto)
  historique?: MessageHistoriqueDto[];
}
