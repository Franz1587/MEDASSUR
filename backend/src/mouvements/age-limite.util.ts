// Calcul d'âge et vérification des limites d'âge par contrat — voir
// Contrat.limiteAgeAdulte/limiteAgeEnfant/limiteAgeEnfantScolarise et
// AssureSante.scolarise (schema.prisma). Assurés principaux et conjoints :
// 0 à limiteAgeAdulte (65 par défaut). Enfants : 0 à limiteAgeEnfant (21 par
// défaut), ou jusqu'à limiteAgeEnfantScolarise si l'enfant est marqué
// scolarisé. Utilisé à la fois pour refuser une incorporation hors limite
// (MouvementsService.appliquerMouvement, SanteService.importPopulation,
// MouvementsService.basculerLot) et pour la radiation automatique
// quotidienne (MouvementsService.radierHorsLimiteAge).

export function calculerAgeAns(dateNaissance: string | null | undefined, reference: Date): number | null {
  if (!dateNaissance) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateNaissance.trim());
  if (!m) return null;
  const [, jj, mm, aaaa] = m;
  const naissance = new Date(Number(aaaa), Number(mm) - 1, Number(jj));
  if (Number.isNaN(naissance.getTime())) return null;
  let age = reference.getFullYear() - naissance.getFullYear();
  const avantAnniversaireCetteAnnee =
    reference.getMonth() < naissance.getMonth() ||
    (reference.getMonth() === naissance.getMonth() && reference.getDate() < naissance.getDate());
  if (avantAnniversaireCetteAnnee) age--;
  return age;
}

export interface ContratLimitesAge {
  id: string;
  limiteAgeAdulte?: number | null;
  limiteAgeEnfant?: number | null;
  limiteAgeEnfantScolarise?: number | null;
}

export interface PersonneAge {
  typeAssure?: string | null;
  dateNaissance?: string | null;
  scolarise?: boolean | null;
}

export function limiteApplicable(contrat: ContratLimitesAge, typeAssure: string | null | undefined, scolarise: boolean | null | undefined): number | null {
  const t = (typeAssure ?? "").toUpperCase();
  if (t === "AS" || t === "CJ") return contrat.limiteAgeAdulte ?? null;
  if (t === "EF") {
    if (scolarise && contrat.limiteAgeEnfantScolarise != null) return contrat.limiteAgeEnfantScolarise;
    return contrat.limiteAgeEnfant ?? null;
  }
  return null;
}

// Retourne un message d'erreur français si `personne` dépasse la limite
// d'âge applicable sur `contrat`, sinon null. Ne bloque jamais si la date de
// naissance est absente/illisible ou si aucune limite n'est configurée —
// l'âge n'est alors simplement pas vérifiable.
export function verifierAge(contrat: ContratLimitesAge, personne: PersonneAge, reference: Date): string | null {
  const limite = limiteApplicable(contrat, personne.typeAssure, personne.scolarise);
  if (limite == null) return null;
  const age = calculerAgeAns(personne.dateNaissance, reference);
  if (age == null || age <= limite) return null;

  const t = (personne.typeAssure ?? "").toUpperCase();
  const extension =
    t === "EF" && !personne.scolarise && contrat.limiteAgeEnfantScolarise != null
      ? ` (jusqu'à ${contrat.limiteAgeEnfantScolarise} ans si l'enfant est scolarisé)`
      : "";
  return `Âge hors limite pour le contrat ${contrat.id} : ${age} ans, limite ${limite} ans${extension}.`;
}
