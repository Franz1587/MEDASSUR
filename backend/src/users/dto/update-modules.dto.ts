import { IsArray, IsString } from "class-validator";

// Voir demande utilisateur : "c'est l'administrateur qui donne les droits
// aux fonctionnalités... un utilisateur a accès aux fonctionnalités qu'on
// lui aura attribué" — liste complète des View (frontend) accordées à cet
// utilisateur, remplace la liste précédente (pas un ajout incrémental).
export class UpdateModulesDto {
  @IsArray()
  @IsString({ each: true })
  modules: string[];
}
