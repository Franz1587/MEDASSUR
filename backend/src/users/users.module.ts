import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { UsersMoiController } from "./users-moi.controller";
import { SignaturePubliqueController } from "./signature-publique.controller";

// Ordre des contrôleurs (2026-09) — comblé après coup : Nest/Express
// résolvent les routes dans l'ordre d'enregistrement, jamais par
// spécificité. `UsersController` (routes génériques /users/:id, réservées
// aux rôles d'administration) déclaré AVANT `UsersMoiController`
// interceptait silencieusement TOUTES les routes /users/moi/... (id="moi")
// avec le garde admin de UsersController — cassait le libre-service
// (GET /users/moi renvoyait 403 pour n'importe quel rôle non-admin) depuis
// le tout début de cette fonctionnalité. UsersMoiController (routes plus
// spécifiques) DOIT rester déclaré en premier.
@Module({
  providers: [UsersService],
  controllers: [UsersMoiController, SignaturePubliqueController, UsersController],
  exports: [UsersService],
})
export class UsersModule {}
