import { useEffect, useMemo, useState } from "react";
import { History, Layers, FileDown, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { getMesPrisesEnCharge, getMaFamille, getMoi, openDecompteDe, openFeuilleSoinsDe, openFeuilleExamenDe, type MembrePriseEnCharge } from "@/services/portailMembre.service";
import { useAuth } from "@/auth/AuthContext";
import { GROUPES_ACTES } from "@/features/portail-prestataire/prestationTypes";

function statutVariant(s: string): BadgeVariant {
  return s === "Accordé" ? "success" : s === "Rejeté" ? "danger" : "warning";
}

// Feuille de soins / feuille d'examen (2026-08) — voir demande utilisateur :
// "chaque fiche de consultation génère aussi une feuille de soins et
// chaque saisie d'un examen, actes de spécialité, analyse médicale génère
// une feuille d'examen. Le but est de dématérialiser cela" — décide, par
// ligne, laquelle des deux proposer (aucune des deux pour les autres
// familles, ex. Pharmacie/Dentaire/Kinésithérapie).
const GROUPES_EXAMEN = new Set(["Analyse", "Imagerie", "ActesSpecialites"]);
function typeFormulaire(acteFamille: string | null | undefined): "soins" | "examen" | null {
  const groupe = GROUPES_ACTES.find((g) => acteFamille && g.familles.includes(acteFamille))?.cle;
  if (groupe === "Consultation") return "soins";
  if (groupe && GROUPES_EXAMEN.has(groupe)) return "examen";
  return null;
}

interface Beneficiaire { id: string; nom: string }

// Historique de mes soins (2026-08) — voir demande utilisateur :
// "l'historique des consommations doit être rangé par rubrique, par
// exercice et même par bénéficiaire dans la famille". Couvre TOUT le foyer
// (rubrique/exercice résolus côté serveur, voir PortailMembreController) —
// rangé par exercice, puis par rubrique au sein de chaque exercice, avec
// des filtres bénéficiaire/rubrique pour affiner.
export default function MembreHistoriqueView() {
  const { currentUser } = useAuth();
  const [lignes, setLignes] = useState<MembrePriseEnCharge[] | null>(null);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[] | null>(null);
  const [beneficiaireId, setBeneficiaireId] = useState<string | null>(null);
  const [rubrique, setRubrique] = useState<string | null>(null);
  const [detailOuvert, setDetailOuvert] = useState<Set<string>>(new Set());

  useEffect(() => {
    getMesPrisesEnCharge().then(setLignes);
    Promise.all([getMoi(), getMaFamille()]).then(([moi, famille]) => {
      setBeneficiaires([
        { id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim() },
        ...famille.map((m) => ({ id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() })),
      ]);
    });
  }, []);

  const rubriques = useMemo(() => [...new Set((lignes ?? []).map((l) => l.rubrique))].sort(), [lignes]);

  const filtrees = useMemo(() => {
    return (lignes ?? []).filter((l) => {
      if (beneficiaireId && l.assureId !== beneficiaireId) return false;
      if (rubrique && l.rubrique !== rubrique) return false;
      return true;
    });
  }, [lignes, beneficiaireId, rubrique]);

  const telechargerDecompte = async (l: MembrePriseEnCharge) => {
    try {
      await openDecompteDe(l.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Décompte indisponible.");
    }
  };

  const telechargerFormulaire = async (l: MembrePriseEnCharge, type: "soins" | "examen") => {
    try {
      await (type === "soins" ? openFeuilleSoinsDe(l.id) : openFeuilleExamenDe(l.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Formulaire indisponible.");
    }
  };

  const basculerDetail = (id: string) => {
    setDetailOuvert((v) => {
      const s = new Set(v);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  };

  const groupesExercice = useMemo(() => {
    const parExercice = new Map<string, MembrePriseEnCharge[]>();
    for (const l of filtrees) {
      const cle = l.exercice != null ? `Exercice ${l.exercice}` : "Hors exercice";
      (parExercice.get(cle) ?? parExercice.set(cle, []).get(cle)!).push(l);
    }
    return [...parExercice.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([exercice, items]) => {
        const parRubrique = new Map<string, MembrePriseEnCharge[]>();
        for (const l of items) (parRubrique.get(l.rubrique) ?? parRubrique.set(l.rubrique, []).get(l.rubrique)!).push(l);
        return {
          exercice,
          rubriques: [...parRubrique.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, ls]) => ({ rubrique: r, lignes: ls })),
        };
      });
  }, [filtrees]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Historique de soins</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Tous les soins de votre foyer</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Combobox
            options={beneficiaires ?? []}
            value={(beneficiaires ?? []).find((b) => b.id === beneficiaireId) ?? null}
            onChange={(b) => setBeneficiaireId(b?.id ?? null)}
            getLabel={(b) => b.id === currentUser?.assureSanteId ? `${b.nom} (vous)` : b.nom}
            getId={(b) => b.id}
            allowClear clearLabel="Tous les bénéficiaires"
          />
        </div>
        <div className="w-56">
          <Combobox
            options={rubriques}
            value={rubrique}
            onChange={setRubrique}
            getLabel={(r) => r} getId={(r) => r}
            allowClear clearLabel="Toutes les rubriques"
          />
        </div>
      </div>

      {!lignes ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : groupesExercice.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun soin enregistré pour ces critères.</div>
      ) : (
        <div className="space-y-6">
          {groupesExercice.map((g) => (
            <div key={g.exercice}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5 flex items-center gap-1.5"><History className="w-3.5 h-3.5" />{g.exercice}</p>
              <div className="space-y-4">
                {g.rubriques.map((r) => (
                  <div key={r.rubrique}>
                    <p className="text-[11.5px] font-semibold text-primary mb-1.5 flex items-center gap-1.5"><Layers className="w-3 h-3" />{r.rubrique}</p>
                    <div className="space-y-2">
                      {r.lignes.map((l) => {
                        const ouvert = detailOuvert.has(l.id);
                        // Regroupement facture + rubrique (2026-08) — voir
                        // demande utilisateur : "dans le cas où une facture
                        // a plusieurs actes de même famille, il n'est pas
                        // nécessaire de l'éclater. On pourra voir la liste
                        // des actes dans les détails en cliquant sur 'Voir
                        // le détail'." La ligne 0 de `l.lignes` sert au
                        // Décompte (rendu au niveau FACTURE côté serveur,
                        // n'importe quel acte de la même facture y mène).
                        const groupe = (l.lignes?.length ?? 0) > 1;
                        const ligneDecompte = groupe ? l.lignes![0] : l;
                        return (
                          <div key={l.id} className="bg-card border border-border rounded-xl p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[13px] font-semibold text-foreground">{l.type}</p>
                                  <Badge variant="info">{l.assureId === currentUser?.assureSanteId ? "Vous" : l.assureNom}</Badge>
                                  {groupe && <Badge variant="neutral">{l.lignes!.length} actes</Badge>}
                                </div>
                                <p className="text-[11.5px] text-muted-foreground mt-0.5">{l.prestataire} · {l.date}</p>
                              </div>
                              <Badge variant={statutVariant(l.statut)}>{l.statut}</Badge>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-[12px]">
                              <span className="text-muted-foreground">{l.modePaiement ?? "—"}</span>
                              {/* Remboursement : la part assurance (baseRemboursement) est
                                  ce qui est réellement reversé — jamais les frais réels
                                  présentés, voir demande utilisateur. */}
                              {l.modePaiement === "Remboursement" && l.baseRemboursement != null ? (
                                <span className="text-emerald-600 font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.baseRemboursement)} FCFA</span>
                              ) : (
                                <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)} FCFA</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <button
                                type="button"
                                onClick={() => basculerDetail(l.id)}
                                className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                              >
                                {ouvert ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {ouvert ? "Masquer le détail" : "Voir le détail"}
                              </button>
                              {ligneDecompte.factureId && (
                                <button
                                  type="button"
                                  onClick={() => telechargerDecompte(ligneDecompte)}
                                  className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
                                >
                                  <FileDown className="w-3.5 h-3.5" />Décompte
                                </button>
                              )}
                              {!groupe && typeFormulaire(l.acteFamille) === "soins" && (
                                <button
                                  type="button"
                                  onClick={() => telechargerFormulaire(l, "soins")}
                                  className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
                                >
                                  <FileDown className="w-3.5 h-3.5" />Feuille de soins
                                </button>
                              )}
                              {!groupe && typeFormulaire(l.acteFamille) === "examen" && (
                                <button
                                  type="button"
                                  onClick={() => telechargerFormulaire(l, "examen")}
                                  className="flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:underline"
                                >
                                  <FileDown className="w-3.5 h-3.5" />Feuille d'examen
                                </button>
                              )}
                            </div>
                            {ouvert && groupe && (
                              <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                                {l.lignes!.map((item) => {
                                  const type = typeFormulaire(item.acteFamille);
                                  return (
                                    <div key={item.id} className="flex items-center justify-between gap-2 py-1 border-b border-border/40 last:border-0 text-[12px]">
                                      <div className="min-w-0">
                                        <p className="text-foreground font-medium truncate">{item.acteLibelle ?? item.type}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                          {fmtM(item.montant)} FCFA{item.baseRemboursement != null ? ` · remboursé ${fmtM(item.baseRemboursement)} FCFA` : ""}
                                        </p>
                                      </div>
                                      {type && (
                                        <button
                                          type="button"
                                          onClick={() => telechargerFormulaire(item, type)}
                                          className="flex-shrink-0 text-[11px] font-medium text-primary hover:underline"
                                        >
                                          {type === "soins" ? "Feuille de soins" : "Feuille d'examen"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {ouvert && !groupe && (
                              <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                                {l.acteLibelle && (<><span className="text-muted-foreground">Acte</span><span className="text-foreground text-right font-medium">{l.acteLibelle}</span></>)}
                                <span className="text-muted-foreground">Remboursé</span>
                                <span className="text-foreground text-right" style={{ fontFamily: "'DM Mono', monospace" }}>{l.baseRemboursement != null ? `${fmtM(l.baseRemboursement)} FCFA` : "—"}</span>
                                <span className="text-muted-foreground">Reste à charge</span>
                                <span className="text-foreground text-right" style={{ fontFamily: "'DM Mono', monospace" }}>{l.resteACharge != null ? `${fmtM(l.resteACharge)} FCFA` : "—"}</span>
                                {l.tauxRemboursement != null && (<><span className="text-muted-foreground">Taux appliqué</span><span className="text-foreground text-right">{l.tauxRemboursement}%</span></>)}
                                {l.franchise != null && (<><span className="text-muted-foreground">Franchise</span><span className="text-foreground text-right" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.franchise)} FCFA</span></>)}
                                {l.plafondApplique != null && (<><span className="text-muted-foreground">Plafond appliqué</span><span className="text-foreground text-right" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.plafondApplique)} FCFA</span></>)}
                                {l.statutControleMedical && (<><span className="text-muted-foreground">Contrôle médical</span><span className="text-foreground text-right">{l.statutControleMedical}</span></>)}
                                {l.motifRejet && (<><span className="text-muted-foreground">Motif de rejet</span><span className="text-destructive text-right">{l.motifRejet}</span></>)}
                                {l.nSinistre && (<><span className="text-muted-foreground">N° sinistre</span><span className="text-foreground text-right">{l.nSinistre}</span></>)}
                                {l.natureMaladie && (<><span className="text-muted-foreground">Nature</span><span className="text-foreground text-right">{l.natureMaladie}</span></>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
