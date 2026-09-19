import { IsInt, Min } from "class-validator";

// Un lot de numéros de chèque pré-paramétré pour une banque (ex. 50 à la
// fois, voir schema.prisma LotCheques) — numeroDebut et numeroFin sont les
// bornes de la série physique de chéquier remise par la banque.
export class CreateLotChequesDto {
  @IsInt()
  @Min(1)
  numeroDebut: number;

  @IsInt()
  @Min(1)
  numeroFin: number;
}
