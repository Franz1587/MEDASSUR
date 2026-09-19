import { IsString } from "class-validator";

export class CreateFactureDto {
  @IsString()
  prestataireId: string;

  @IsString()
  contratId: string;

  @IsString()
  dateReception: string;

  @IsString()
  referenceFacture: string;
}
