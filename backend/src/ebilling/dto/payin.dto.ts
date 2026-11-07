import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, MinLength } from "class-validator";
import { DESCRIPTION_MAX, EBILLING_MAX_MONTANT, MSISDN_REGEX, OPERATEURS_PAYIN } from "../ebilling.constants";

// Chaîne vide (champ de formulaire non rempli) → absent.
const videEnUndefined = ({ value }: { value: unknown }) => (value === "" ? undefined : value);
const nettoyerMsisdn = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.replace(/[\s.\-()]/g, "") || undefined : value;

export class CreatePayinDto {
  @IsInt()
  @IsPositive()
  @Max(EBILLING_MAX_MONTANT)
  montant!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(DESCRIPTION_MAX)
  description!: string;

  @IsIn(OPERATEURS_PAYIN as unknown as string[])
  operateur!: string;

  @IsOptional()
  @Transform(nettoyerMsisdn)
  @Matches(MSISDN_REGEX, { message: "msisdn invalide" })
  msisdn?: string;

  @IsOptional()
  @Transform(videEnUndefined)
  @IsString()
  @MaxLength(120)
  nom?: string;

  @IsOptional()
  @Transform(videEnUndefined)
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @Transform(videEnUndefined)
  @IsString()
  @MaxLength(64)
  contratId?: string;
}
