import { IsOptional, IsString } from "class-validator";

export class EnregistrerPushTokenDto {
  @IsOptional()
  @IsString()
  token?: string;
}
