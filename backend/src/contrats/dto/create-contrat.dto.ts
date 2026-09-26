import { IsArray, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateContratDto {
  @IsString()
  clientId: string;

  @IsString()
  compagnieId: string;

  @IsIn(["Maladie", "Assistance"])
  branche: string;

  @IsString()
  dateDebut: string;

  @IsString()
  dateFin: string;

  // Utilisée uniquement en repli si la population par catégorie n'est
  // pas fournie — sinon la prime est recalculée intégralement côté serveur.
  @IsNumber()
  prime: number;

  // "Résilié" manquait ici (2026-09) — voir ContratsService.
  // STATUTS_CONTRAT_VALIDES pour la liste réelle : toute sauvegarde d'un
  // contrat déjà résilié (avenant de résiliation ou import direct)
  // échouait en 400 dès qu'un AUTRE champ (période, garanties...) était
  // corrigé sur ce même contrat, alors que son statut n'avait pas changé.
  @IsIn(["Actif", "En renouvellement", "Expiré", "Résilié"])
  statut: string;

  // Numéro de police (2026-08) — auto-généré côté serveur si absent (voir
  // ContratsService.prochainNumeroPolice), mais transmissible pour la
  // reprise d'antériorité (numéro déjà attribué par la compagnie).
  @IsOptional()
  @IsString()
  numeroPolice?: string;

  // Nom imprimé sur la carte santé (voir schema.prisma Contrat.nomCarteSante) —
  // chaîne vide = retour au nom du souscripteur.
  @IsOptional()
  @IsString()
  nomCarteSante?: string;

  // Bureau de rattachement (2026-09) — voir schema.prisma Contrat.agenceId :
  // "LA RUCHE a un bureau à Port-Gentil qui gère ses contrats de façon
  // autonome". Facultatif, aucun bureau particulier par défaut.
  @IsOptional()
  @IsString()
  agenceId?: string;

  @IsOptional()
  @IsIn(["Mensuel", "Trimestriel", "Semestriel", "Annuel"])
  periodicite?: string;

  // Libellé produit (2026-08) — voir Bordereau de Production, colonne
  // "Produit" (ex. "PEC UPEGA COLLEGE 1"), distinct de `branche`.
  @IsOptional()
  @IsString()
  produit?: string;

  @IsOptional()
  @IsString()
  paysSouscription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extensionsTerritorialite?: string[];

  // Assistance liée (2026-08) — renseigné uniquement sur un contrat
  // Assistance : pointe vers son contrat Maladie, dont il partage
  // exactement la population (voir schema.prisma, model Contrat).
  @IsOptional()
  @IsString()
  contratMaladieLieId?: string;

  @IsOptional()
  @IsString()
  tauxCouvertureAmbulatoire?: string;

  @IsOptional()
  @IsString()
  tauxCouvertureHospitalisation?: string;

  // Déclinaison structure publique/privée (2026-08) — voir schema.prisma
  // pour l'usage (carte d'assurance + calcul PriseEnCharge).
  @IsOptional() @IsString() tauxAmbulatoirePublique?: string;
  @IsOptional() @IsString() tauxAmbulatoirePrivee?: string;
  @IsOptional() @IsString() tauxHospitalisationPublique?: string;
  @IsOptional() @IsString() tauxHospitalisationPrivee?: string;
  // Taux ayants droit distincts (2026-08) — VRAIMENT en option, voir
  // schema.prisma Contrat : vides par défaut, un CJ/EF suit alors
  // exactement le taux de l'assuré principal ci-dessus.
  @IsOptional() @IsString() tauxAmbulatoirePubliqueAyantDroit?: string;
  @IsOptional() @IsString() tauxAmbulatoirePriveeAyantDroit?: string;
  @IsOptional() @IsString() tauxHospitalisationPubliqueAyantDroit?: string;
  @IsOptional() @IsString() tauxHospitalisationPriveeAyantDroit?: string;

  // ── Population par catégorie (nombre × prime unitaire) ───────────────
  @IsOptional() @IsNumber() @Min(0) nombreAssuresPrincipaux?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireAssurePrincipal?: number;
  @IsOptional() @IsNumber() @Min(0) nombreConjoints?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireConjoint?: number;
  @IsOptional() @IsNumber() @Min(0) nombreEnfants?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireEnfant?: number;
  @IsOptional() @IsNumber() @Min(0) nombreCouples?: number;
  @IsOptional() @IsNumber() @Min(0) primeUnitaireCouple?: number;

  // ── Territorialité, limites, plafonds ────────────────────────────────
  @IsOptional() @IsNumber() tauxTerritorialite?: number;
  @IsOptional() @IsNumber() @Min(0) limiteAgeAdulte?: number;
  @IsOptional() @IsNumber() @Min(0) limiteAgeEnfant?: number;
  @IsOptional() @IsNumber() @Min(0) limiteAgeEnfantScolarise?: number;
  @IsOptional() @IsNumber() @Min(0) limitePersFamille?: number;
  @IsOptional() @IsNumber() @Min(0) plafondAdherent?: number;
  @IsOptional() @IsNumber() @Min(0) plafondFamille?: number;
  @IsOptional() @IsNumber() @Min(0) plafondPolice?: number;

  // ── Ajustements & accessoires ────────────────────────────────────────
  @IsOptional() @IsNumber() tauxMinoMajoration?: number;
  @IsOptional() @IsNumber() tauxReductionCommerciale?: number;
  // Montant forfaitaire (communiqué par la compagnie ou saisi manuellement) — PAS un taux.
  @IsOptional() @IsNumber() @Min(0) montantAccessoires?: number;
  @IsOptional() @IsNumber() tauxCommission?: number;
  @IsOptional() @IsNumber() @Min(0) tauxChargement?: number;
}
