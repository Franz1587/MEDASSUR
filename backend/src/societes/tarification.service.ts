import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpsertModulePrixDto } from "./dto/module-prix.dto";
import { UpsertTauxChangeDto } from "./dto/taux-change.dto";
import { UpdateParametresFacturationDto } from "./dto/parametres-facturation.dto";

// Tarification par module + taux de change (2026-09) — voir demande
// utilisateur : "l'application doit pouvoir évaluer un coût pour chaque
// fonctionnalité (rendre paramétrable) afin que l'option d'abonnement
// s'enrichisse en fonction des fonctionnalités cochées... faire une
// correspondance en euro/dollars et convertir en FCFA (XAF)." Catalogue
// entièrement géré par le Super Admin — voir aussi TarificationController.
@Injectable()
export class TarificationService {
  constructor(private prisma: PrismaService) {}

  getModulePrix() {
    return this.prisma.modulePrix.findMany({ orderBy: { module: "asc" } });
  }

  async upsertModulePrix(dto: UpsertModulePrixDto) {
    return this.prisma.modulePrix.upsert({
      where: { module: dto.module },
      update: { prix: dto.prix, devise: dto.devise },
      create: { module: dto.module, prix: dto.prix, devise: dto.devise },
    });
  }

  getTauxChange() {
    return this.prisma.tauxChange.findMany({ orderBy: { devise: "asc" } });
  }

  async upsertTauxChange(dto: UpsertTauxChangeDto) {
    return this.prisma.tauxChange.upsert({
      where: { devise: dto.devise },
      update: { tauxVersXaf: dto.tauxVersXaf },
      create: { devise: dto.devise, tauxVersXaf: dto.tauxVersXaf },
    });
  }

  // Prix mensuel en FCFA d'une sélection de modules — somme des prix
  // catalogue (convertis depuis leur devise propre), module absent du
  // catalogue = gratuit (jamais bloquant). Voir demande utilisateur :
  // "l'option d'abonnement s'enrichisse en fonction des fonctionnalités
  // cochées" — c'est cette fonction que le picker de modules appelle en
  // direct (voir /tarification/estimation) pour afficher un total qui
  // grandit à chaque case cochée.
  async calculerPrixModules(modules: string[]): Promise<number> {
    if (modules.length === 0) return 0;
    const [prix, taux] = await Promise.all([
      this.prisma.modulePrix.findMany({ where: { module: { in: modules } } }),
      this.prisma.tauxChange.findMany(),
    ]);
    const tauxParDevise = new Map(taux.map((t) => [t.devise, Number(t.tauxVersXaf)]));
    let total = 0;
    for (const p of prix) {
      const tauxApplicable = tauxParDevise.get(p.devise) ?? 1;
      total += Number(p.prix) * tauxApplicable;
    }
    return Math.round(total);
  }

  // Tarification par personne assurée (2026-09) — voir demande
  // utilisateur : "en plus de la tarification liée aux fonctionnalités, il
  // y a la licence annuelle par assuré... on facture la carte par assuré
  // et ayant droit." Ligne unique globale (voir ParametresFacturationPlateforme),
  // créée paresseusement au premier accès pour que les nouvelles
  // installations démarrent avec les valeurs par défaut sans étape de
  // configuration obligatoire (même principe que ParametresEntrepriseService).
  getParametresFacturation() {
    return this.prisma.parametresFacturationPlateforme.upsert({
      where: { id: "default" },
      update: {},
      create: { id: "default" },
    });
  }

  updateParametresFacturation(dto: UpdateParametresFacturationDto) {
    return this.prisma.parametresFacturationPlateforme.upsert({
      where: { id: "default" },
      update: dto,
      create: { id: "default", ...dto },
    });
  }
}
