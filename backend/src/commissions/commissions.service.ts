import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BordereauxService } from "../bordereaux/bordereaux.service";

const MOIS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function parseDateFr(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/").map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
}

// Libellé de période mensuelle ("Octobre 2024") — uniquement quand du/au
// tombent tous deux dans le même mois civil ; sert de clé stable pour
// retrouver/enregistrer le statut de reversement (voir CommissionReversement,
// schema.prisma). Une recherche sur une plage plus large ou sans dates
// n'a pas de clé de reversement exploitable (retourne null).
function periodeMensuelle(du?: string, au?: string): string | null {
  const d = parseDateFr(du);
  const a = parseDateFr(au);
  if (!d || !a) return null;
  if (d.getFullYear() !== a.getFullYear() || d.getMonth() !== a.getMonth()) return null;
  return `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function cleCourte(du?: string, au?: string): string {
  const d = parseDateFr(du);
  if (!d) return "TOUT";
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0");
  const periodeMois = periodeMensuelle(du, au);
  return periodeMois ? `${y}${m}` : `${y}${m}-P`;
}

// Commissions (2026-08, refonte) — voir demande utilisateur : "c'est le
// courtier qui est le bénéficiaire des commissions et elles sont calculées
// sur la base des taux commissions paramétrés pour chaque branche... et
// calculé sur la base des primes nettes générées par contrat". Plus aucun
// montant n'est saisi à la main ici : on réutilise directement
// BordereauxService.production (mêmes Contrat.primeNette/montantCommission
// que le Bordereau de Production — voir demande utilisateur : "total
// cohérence entre les fonctionnalités... suite logique et
// interconnexion"). Seul le statut de reversement (la compagnie a-t-elle
// physiquement reversé la commission au courtier) reste un fait réel,
// mémorisé dans CommissionReversement, clé par (compagnieId, période
// mensuelle).
@Injectable()
export class CommissionsService {
  constructor(private prisma: PrismaService, private bordereaux: BordereauxService) {}

  async findAll(du?: string, au?: string) {
    const { groupes } = await this.bordereaux.production(du, au);
    const compagnies = await this.prisma.compagnie.findMany({ where: { id: { in: groupes.map((g) => g.compagnieId) } } });
    const compagnieParId = new Map(compagnies.map((c) => [c.id, c]));
    const periode = periodeMensuelle(du, au);

    const reversements = periode
      ? await this.prisma.commissionReversement.findMany({ where: { compagnieId: { in: groupes.map((g) => g.compagnieId) }, periode } })
      : [];
    const reversementParCompagnie = new Map(reversements.map((r) => [r.compagnieId, r]));

    return groupes
      .filter((g) => g.totaux.primes > 0)
      .map((g) => {
        const compagnie = compagnieParId.get(g.compagnieId);
        const reversement = reversementParCompagnie.get(g.compagnieId);
        const tauxMoyen = g.totaux.primes > 0 ? (g.totaux.commission / g.totaux.primes) * 100 : 0;
        return {
          id: `COM-${compagnie?.code || g.compagnieId}-${cleCourte(du, au)}`,
          compagnieId: g.compagnieId,
          compagnie: g.compagnie,
          periode: periode ?? (du && au ? `${du} au ${au}` : "Toute période"),
          periodeMensuelle: periode,
          primeNette: g.totaux.primes,
          tauxCommission: `${tauxMoyen.toFixed(1)}%`,
          montantCommission: g.totaux.commission,
          statut: reversement?.statut ?? "En attente",
        };
      })
      .sort((a, b) => a.compagnie.localeCompare(b.compagnie));
  }

  async reverser(compagnieId: string, periode: string) {
    // Vérifie que la compagnie appartient bien à la société de l'appelant
    // (2026-09) — Compagnie est cloisonnée par le middleware Prisma, donc
    // ce findUnique échoue silencieusement pour l'id d'une AUTRE société ;
    // CommissionReversement lui-même n'a pas de societeId propre (reversé
    // en fonction de la compagnie, jamais interrogé en liste sans passer
    // par des compagnies déjà cloisonnées — voir findAll ci-dessus), donc
    // seule cette vérification côté écriture empêchait un id deviné de
    // modifier le reversement d'une autre société.
    const compagnie = await this.prisma.compagnie.findUnique({ where: { id: compagnieId } });
    if (!compagnie) throw new NotFoundException(`Compagnie ${compagnieId} introuvable`);
    return this.prisma.commissionReversement.upsert({
      where: { compagnieId_periode: { compagnieId, periode } },
      update: { statut: "Reversé", dateReversement: new Date().toLocaleDateString("fr-FR") },
      create: {
        compagnieId, periode, statut: "Reversé",
        dateReversement: new Date().toLocaleDateString("fr-FR"),
      },
    });
  }
}
