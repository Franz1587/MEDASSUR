import { IsNotEmpty, IsString } from "class-validator";

// Correction manuelle d'un exercice (2026-08) — voir demande utilisateur :
// "il peut arriver que les données de l'import de date d'un exercice ne
// soit pas correct, on doit pouvoir aller modifier pour que l'application
// fasse un récalibrage au niveau des échéances et des dates d'effet."
// Les deux dates sont prises TELLES QUELLES (jamais forcées à 12 mois —
// un exercice peut être plus court, voir schema.prisma) ; c'est le
// RECALIBRAGE des exercices SUIVANTS (voir ContratsService.
// recalibrerExercice) qui applique la tacite reconduction à partir de la
// nouvelle échéance corrigée.
export class UpdateExerciceDto {
  @IsString() @IsNotEmpty() dateDebut: string;
  @IsString() @IsNotEmpty() dateFin: string;
}
