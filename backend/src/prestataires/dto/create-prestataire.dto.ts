import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { normaliserTelephone } from "../../lib/telephone.util";

export class CreatePrestataireDto {
  // Seul champ réellement obligatoire à la saisie (2026-09) — voir demande
  // utilisateur : "à part le nom... il ne faut pas rendre les autres
  // données obligatoire pour enregistrer ou modifier un prestataire."
  // `secteur` ci-dessous reste une EXCEPTION délibérée (voir son
  // commentaire).
  @IsString()
  nom: string;

  // "Médecin" retiré (2026-08) — les médecins ont désormais leur propre
  // modèle dédié (voir schema.prisma Medecin, module backend/src/medecins),
  // distinct des structures gérées ici.
  @IsOptional()
  @IsIn(["Hôpital", "Clinique", "Cabinet", "Centre de Kinésithérapie", "Opticien", "Pharmacie", "Laboratoire", "Dépôt pharmaceutique", "Centre d'Imagerie", "Cabinet Dentaire"])
  type?: string;

  // Détermine le taux de Contrat appliqué lors du calcul d'une
  // PriseEnCharge (voir SanteService.tauxParSecteur) — distinct de `type`.
  // Obligatoire (2026-08) — voir demande utilisateur : "le taux de
  // couverture qui ne remonte pas pour certain assuré". Sans secteur,
  // tauxParSecteur ne peut déterminer aucun taux et laisse la ligne vide ;
  // rendu obligatoire pour empêcher la récurrence (345/353 prestataires
  // importés avaient ce champ vide avant correction en base).
  @IsIn(["Public", "Privé"])
  secteur: string;

  // Spécialité médicale/paramédicale (ex. "Cardiologie", "Kinésithérapie")
  // — texte libre (liste de suggestions côté frontend), complète `type`
  // sans nomenclature fixe en base.
  @IsOptional()
  @IsString()
  specialite?: string;

  @IsOptional()
  @IsString()
  pays?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  // Points retirés à la saisie (2026-08) — voir demande utilisateur :
  // "077.66.00.01... doivent devenir 077660001".
  @IsOptional()
  @IsString()
  @Transform(({ value }) => normaliserTelephone(value))
  telephone?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsIn(["En négociation", "Conventionné", "Suspendu"])
  statutConvention?: string;

  @IsOptional()
  @IsString()
  dateConventionnement?: string;

  // TPS (2026-08) — 9,5% de la base de remboursement, prélevée
  // uniquement chez les prestataires assujettis, sur la fenêtre
  // [tpsDateEffet, tpsDateArret] (voir SanteService.calculerTps).
  @IsOptional()
  @IsBoolean()
  tpsAssujetti?: boolean;

  @IsOptional()
  @IsString()
  tpsDateEffet?: string;

  @IsOptional()
  @IsString()
  tpsDateArret?: string;

  // Visibilité du portail prestataire (2026-08) — voir demande utilisateur :
  // "définir les garanties/actes qui doivent s'afficher en fonction du type
  // de prestataire... une pharmacie, un laboratoire n'aura pas besoin de
  // consultation". Vide/omis = aucune restriction.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  garantiesVisibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoriesActesVisibles?: string[];
}
