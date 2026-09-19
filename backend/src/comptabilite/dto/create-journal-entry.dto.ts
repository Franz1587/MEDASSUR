import { IsNumber, IsString, Min } from "class-validator";

export class CreateJournalEntryDto {
  @IsString()
  date: string;

  @IsString()
  libelle: string;

  @IsString()
  compte: string;

  @IsNumber()
  @Min(0)
  debit: number;

  @IsNumber()
  @Min(0)
  credit: number;
}
