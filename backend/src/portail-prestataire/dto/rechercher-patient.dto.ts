import { IsIn, IsString, MinLength } from "class-validator";

// Identification d'un assuré (2026-08) — voir demande utilisateur : "portail
// externe dédié au prestataire médical", capture de référence fournie par
// l'utilisateur, onglet "Identifier Un Assuré" : Code QR / Carte à puce / Saisie,
// trois types de données possibles pour la saisie manuelle. Code QR/Carte à
// puce nécessitent un lecteur matériel non disponible ici — seule la Saisie
// est dupliquée dans cette première passe (voir demande utilisateur : "on va
// faire des ajustements progressivement").
export class RechercherPatientDto {
  @IsIn(["telephone", "matricule", "numeroAssure"])
  type: "telephone" | "matricule" | "numeroAssure";

  @IsString()
  @MinLength(1)
  valeur: string;
}
