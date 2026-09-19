import { Type } from "class-transformer";
import { IsArray, IsIn, IsString, ValidateNested } from "class-validator";
import { AccordPrealableLigneDto } from "../../accord-prealable/dto/create-accord-prealable.dto";

// Devis / demande de prise en charge (2026-08) — voir demande utilisateur :
// "La partie 'Devis' est une rubrique permettant au prestataire de faire
// une demande de prise en charge de tout type (selon son profil)... hospitalisation,
// actes d'imagerie... quand je parle de demande de prise en charge, je
// parle bien de l'entente préalable." assureId (le patient) + prestataire/
// prestataireId/origine sont TOUJOURS forcés côté serveur
// (PortailPrestataireController) — jamais transmis par le client.
export class CreateDevisMedicalDto {
  @IsString()
  assureId: string;

  @IsIn(["Hospitalisation", "Chirurgie", "EVASAN", "Consultation", "Analyse", "Imagerie", "Dentaire", "Kinesitherapie", "Specialites", "Autre"])
  type: string;

  @IsString()
  dateDemande: string;

  // Lignes facultatives (2026-08) — voir demande utilisateur : "pour les
  // demandes de prise en charge de type hospitalisation on ne charge qu'un
  // seul document [la déclaration], pas d'actes détaillés à ce stade".
  // AccordPrealableService.create gère déjà nativement un tableau vide
  // (repli sur dto.description/dto.montantDevis) — voir aussi le champ
  // "facultatif" déjà affiché côté formulaire (Devis.tsx).
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccordPrealableLigneDto)
  lignes: AccordPrealableLigneDto[];
}
