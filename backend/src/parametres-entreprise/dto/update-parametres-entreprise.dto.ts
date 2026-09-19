import { IsOptional, IsString, Matches } from "class-validator";

const HEX = /^#[0-9a-fA-F]{6}$/;

export class UpdateParametresEntrepriseDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  sousTitre?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  boitePostale?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  pays?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  siteWeb?: string;

  @IsOptional()
  @Matches(HEX, { message: "couleurPrimaire doit être un code hexadécimal (#rrggbb)" })
  couleurPrimaire?: string;

  @IsOptional()
  @Matches(HEX, { message: "couleurSecondaire doit être un code hexadécimal (#rrggbb)" })
  couleurSecondaire?: string;

  // Repris sur le Décompte de Remboursement Maladie ("Agence : <codeAgence>
  // <nom>", voir schema.prisma ParametresEntreprise.codeAgence).
  @IsOptional()
  @IsString()
  codeAgence?: string;

  // Préfixe du matricule assuré (2026-09) — voir SanteMatriculeUtil.
  // prochainMatricule. Chaîne vide = redevient le repli historique
  // (MAT-<aléatoire>).
  @IsOptional()
  @IsString()
  prefixeMatricule?: string;

  // Modèle de carte choisi dans le catalogue partagé (2026-09) — voir
  // model ModeleCarte. null = "classique" (dessin généré, comportement
  // historique).
  @IsOptional()
  @IsString()
  modeleCarteId?: string | null;

  // Texte du verso de carte éditable (2026-09) — voir demande utilisateur :
  // "il faudrait que l'application puisse générer ces deux blocs de texte
  // au lieu de les laisser figés... éditables." Chaîne vide/absente =
  // revient au fond importé tel quel (comportement historique).
  @IsOptional()
  @IsString()
  carteVersoIntro?: string;

  @IsOptional()
  @IsString()
  carteVersoTelephone?: string;

  // 3ᵉ bloc éditable (2026-09) — voir demande utilisateur : "il faut
  // aussi rendre ce texte éditable" (explication du QR Code).
  @IsOptional()
  @IsString()
  carteVersoQrExplication?: string;
}
