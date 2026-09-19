import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";

// Reprise d'antériorité — factures (2026-08) — voir demande utilisateur :
// "pour permettre aux sociétés d'assurance qui voudraient changer de
// logiciel... importer les factures saisies." Une ligne = UNE ligne de
// facture (PriseEnCharge) ; plusieurs lignes partageant le même prestataire
// + référence facture sont regroupées sous UNE SEULE Facture (en-tête),
// exactement comme la saisie manuelle (voir ImportService.importerFactures).
//
// Rattaché à UN contrat (2026-08 — voir demande utilisateur : "rendre
// l'import des factures... possible pour un contrat comme avec modèle qui
// se génère pour que les données match avec la population du contrat")
// — le matricule/nom sont résolus DANS la population de CE contrat
// uniquement (jamais une recherche globale sur toute la base), voir
// ImportService.resoudreAssureDuContrat.
export class ImportFactureRowDto {
  // Matricule OU nom (voir demande utilisateur : "les factures doivent
  // s'importer par numéro matricule ou le nom de l'assuré ou l'ayant
  // droit") — au moins l'un des deux est requis (vérifié en service, pas
  // ici, pour un message d'erreur précis par ligne plutôt qu'un rejet
  // DTO générique).
  @IsOptional()
  @IsString()
  matricule?: string;

  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  prenom?: string;

  @IsString()
  prestataire: string;

  @IsString()
  referenceFacture: string;

  @IsString()
  dateReception: string;

  // Ambulatoire | Hospitalisation | Dentisterie | Optique | Kinésithérapie
  // & Cure thermale | Maternité | Transport | Autre (voir TYPES_PRESTATION,
  // sante/dto/create-facture-ligne.dto.ts).
  @IsString()
  typePrestation: string;

  @IsString()
  datePrestation: string;

  // Facultatif (2026-08 — voir demande utilisateur : "il faut rendre la
  // prestation facultative") — un ancien système n'a pas toujours de code
  // d'acte précis. Absent ou introuvable dans le catalogue, la ligne est
  // quand même créée avec un repère générique (voir ImportService.
  // resoudreActe/LIBELLE_ACTE_NON_DETAILLE) — jamais rejetée pour ce
  // seul motif.
  @IsOptional()
  @IsString()
  acteMedical?: string;

  @IsString()
  montant: string;

  @IsOptional()
  @IsString()
  quantite?: string;

  // Accepté | Rejeté (défaut Accepté si absent).
  @IsOptional()
  @IsString()
  statut?: string;

  @IsOptional()
  @IsString()
  motifRejet?: string;
}

export class ImportFacturesDto {
  @IsString()
  contratId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportFactureRowDto)
  rows: ImportFactureRowDto[];
}
