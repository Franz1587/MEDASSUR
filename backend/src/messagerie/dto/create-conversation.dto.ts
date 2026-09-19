import { IsIn, IsString, MinLength } from "class-validator";

// Objet obligatoire à l'ouverture (2026-08) — voir demande utilisateur :
// "l'application doit... donner systématiquement un objet dès l'ouverture
// de la discussion". `canal` = choix initial de l'externe entre agent IA
// et agent humain (voir demande utilisateur : "les personnes externes
// peuvent... discuter directement avec un agent IA ou un agent réel de
// l'assurance") — sans effet pour un agent interne qui ouvre lui-même une
// conversation (toujours "Humain" côté serveur, voir MessagerieService).
export class CreateConversationDto {
  @IsString()
  @MinLength(3)
  objet: string;

  @IsIn(["IA", "Humain"])
  canal: string;

  @IsString()
  @MinLength(1)
  message: string;
}
