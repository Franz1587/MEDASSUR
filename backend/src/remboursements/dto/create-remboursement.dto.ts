import { IsIn, IsOptional, IsString } from "class-validator";

export class CreateRemboursementDto {
  // Voir demande utilisateur : "le remboursement... est à l'ordre de
  // l'assuré ou de son souscripteur selon les clauses contractuelles".
  @IsIn(["AssurePrincipal", "Souscripteur"])
  beneficiaire: string;

  // Requis seulement si beneficiaire = "AssurePrincipal".
  @IsOptional()
  @IsString()
  assurePrincipalId?: string;

  @IsString()
  contratId: string;

  @IsString()
  dateDeclaration: string;
}
