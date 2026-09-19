import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { SocieteUsersService } from "./societe-users.service";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { UpdateUserDto } from "../users/dto/update-user.dto";
import { UpdateModulesDto } from "../users/dto/update-modules.dto";

// Utilisateurs d'une société précise, gérés par le Super Admin (2026-09) —
// voir demande utilisateur : "il doit pouvoir créer et gérer des
// utilisateurs pour chaque société et affecter." Distinct de
// UsersController (réservé à l'administrateur DE SA PROPRE société).
@Controller("societes/:societeId/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("super_admin")
export class SocieteUsersController {
  constructor(private readonly service: SocieteUsersService) {}

  @Get()
  findAll(@Param("societeId") societeId: string) {
    return this.service.findAll(societeId);
  }

  @Post()
  create(@Param("societeId") societeId: string, @Body() dto: CreateUserDto) {
    return this.service.create(societeId, dto);
  }

  @Patch(":userId")
  update(@Param("societeId") societeId: string, @Param("userId") userId: string, @Body() dto: UpdateUserDto) {
    return this.service.update(societeId, userId, dto);
  }

  @Patch(":userId/modules")
  updateModules(@Param("societeId") societeId: string, @Param("userId") userId: string, @Body() dto: UpdateModulesDto) {
    return this.service.updateModules(societeId, userId, dto);
  }

  @Patch(":userId/reinitialiser-mot-de-passe")
  reinitialiserMotDePasse(@Param("societeId") societeId: string, @Param("userId") userId: string) {
    return this.service.reinitialiserMotDePasse(societeId, userId);
  }

  @Delete(":userId")
  remove(@Param("societeId") societeId: string, @Param("userId") userId: string) {
    return this.service.remove(societeId, userId);
  }
}
