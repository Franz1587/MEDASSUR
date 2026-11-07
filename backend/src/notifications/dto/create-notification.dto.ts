import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class CreateNotificationDto {
  @IsIn(["Client", "Prestataire", "Gestionnaire", "Assuré"])
  destinataireType: string;

  @IsString()
  @MinLength(1)
  destinataireId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}
