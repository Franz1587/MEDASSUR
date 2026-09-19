import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ALL_VIEWS } from "../auth/role-modules";

// Abonnement de la société courante (2026-09) — voir demande utilisateur :
// "il revient au super Admin de donner accès à ces modules là en fonction
// du type d'abonnement souscrit". Accessible à N'IMPORTE QUEL compte
// authentifié (pas de @Roles) — c'est ce qui permet à l'écran "Droits"
// (voir src/features/admin/index.tsx côté frontend) de savoir quels
// modules son ADMINISTRATEUR peut effectivement accorder à ses propres
// utilisateurs, et d'en griser le reste plutôt que de laisser croire
// qu'ils sont accordables puis les rejeter silencieusement côté serveur
// (voir UsersService.plafonnerModules, la vraie limite appliquée).
@Controller("abonnement")
@UseGuards(JwtAuthGuard)
export class AbonnementController {
  constructor(private prisma: PrismaService) {}

  @Get("moi")
  async moi(@Req() req: { user?: { societeId?: string | null } }) {
    const societeId = req.user?.societeId ?? null;
    // super_admin (aucune société) — aucune limite, voir TenantContext.
    if (!societeId) {
      return { societeId: null, societeNom: null, planNom: null, modules: ALL_VIEWS, type: null, compagnieInterneId: null };
    }
    const societe = await this.prisma.societeAssurance.findUnique({
      where: { id: societeId },
      select: { id: true, nom: true, modules: true, planAbonnement: { select: { nom: true } }, type: true, compagnieInterneId: true },
    });
    if (!societe) return { societeId: null, societeNom: null, planNom: null, modules: ALL_VIEWS, type: null, compagnieInterneId: null };
    return {
      societeId: societe.id, societeNom: societe.nom, planNom: societe.planAbonnement?.nom ?? null, modules: societe.modules,
      // Type de société (2026-09) — voir demande utilisateur, expose ici
      // (endpoint déjà consulté par tout écran interne pour "à quelle
      // société j'appartiens") pour que le formulaire Contrat sache s'il
      // doit masquer le sélecteur Compagnie (voir compagnieInterneId).
      type: societe.type, compagnieInterneId: societe.compagnieInterneId,
    };
  }
}
