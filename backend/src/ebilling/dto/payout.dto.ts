import { Transform } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, MinLength } from "class-validator";
import { DESCRIPTION_MAX, EBILLING_MAX_MONTANT, MAX_BORDEREAUX_PAR_PAYOUT, MSISDN_REGEX, OPERATEURS_PAYOUT } from "../ebilling.constants";

const videEnUndefined = ({ value }: { value: unknown }) => (value === "" ? undefined : value);
const nettoyerMsisdn = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.replace(/[\s.\-()]/g, "") : value;

export class CreatePayoutDto {
  @IsInt()
  @IsPositive()
  @Max(EBILLING_MAX_MONTANT)
  montant!: number;

  @Transform(nettoyerMsisdn)
  @Matches(MSISDN_REGEX, { message: "msisdn invalide" })
  msisdn!: string;

  @IsIn(OPERATEURS_PAYOUT as unknown as string[])
  operateur!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(DESCRIPTION_MAX)
  description!: string;

  @IsOptional()
  @Transform(videEnUndefined)
  @IsString()
  @MaxLength(120)
  nom?: string;

  @IsOptional()
  @Transform(videEnUndefined)
  @IsString()
  @MaxLength(64)
  prestataireId?: string;

  // IDs de BordereauReglement à régler (lien + passage "Payé" au callback).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BORDEREAUX_PAR_PAYOUT)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  bordereauIds?: string[];
}
