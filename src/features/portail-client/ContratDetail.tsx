import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ChevronDown, ChevronUp, Download, FileText, History, Receipt, CalendarRange, UserPlus, UserMinus,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getAvenantsDuContrat } from "@/services/avenants.service";
import { getFacturesProductionDuContrat, type FactureProduction } from "@/services/facture-production.service";
import {
  getExercicesDuContrat, openAvenantDocumentClient, openContratDocumentClient, openFactureProductionDocumentClient,
  type ExerciceContratClient,
} from "@/services/portailClient.service";
import type { Contrat } from "@/types/contrats";
import type { Avenant } from "@/types/avenants";
import { numeroPolice } from "@/lib/police";

function statutVariant(statut: string): BadgeVariant {
  if (statut === "Actif") return "success";
  if (statut === "En renouvellement") return "warning";
  return "neutral";
}

const AVENANT_STATUT_VARIANT: Record<string, BadgeVariant> = { "Brouillon": "neutral", "Validé": "info", "Appliqué": "success" };

const ONGLETS = [
  { id: "general", label: "Général", icon: FileText },
  { id: "mouvements", label: "Mouvements", icon: History },
  { id: "factures", label: "Factures de production", icon: Receipt },
  { id: "exercices", label: "Données par exercice", icon: CalendarRange },
] as const;
type OngletId = (typeof ONGLETS)[number]["id"];

// Ligne d'historique — soit la mise en place du contrat (synthétique, pas un
// Avenant en base — même principe que HistoriqueMouvementsTab.tsx côté
// interne), soit un vrai avenant.
interface LigneMouvement {
  id: string;
  type: string;
  statut: string;
  description: string;
  dateEffet: string;
  primeApres?: number;
  personnes?: Avenant["personnes"];
  estFondateur: boolean;
}

interface Props {
  contrat: Contrat;
  onRetour: () => void;
}

// Page dédiée au détail d'un contrat, côté portail client (2026-08) — voir
// demande utilisateur : "en accédant au contrat on doit voir une page
// dédiée permettant d'avoir la liste des mouvements... l'affaire nouvelle,
// les avenants... un onglet pour les factures de production émises... voir
// les données contractuelles par exercice", puis "cet écran doit aussi
// lister les garanties du contrat". Remplace l'ancienne fenêtre modale —
// occupe toute la zone de contenu, pas une superposition.
export default function ContratDetail({ contrat, onRetour }: Props) {
  const [onglet, setOnglet] = useState<OngletId>("general");
  const [avenants, setAvenants] = useState<Avenant[] | null>(null);
  const [factures, setFactures] = useState<FactureProduction[] | null>(null);
  const [exercices, setExercices] = useState<ExerciceContratClient[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (onglet === "mouvements" && avenants === null) getAvenantsDuContrat(contrat.id).then(setAvenants);
    if (onglet === "factures" && factures === null) getFacturesProductionDuContrat(contrat.id).then(setFactures);
    if (onglet === "exercices" && exercices === null) getExercicesDuContrat(contrat.id).then(setExercices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet, contrat.id]);

  const telecharger = async (cle: string, action: () => Promise<void>) => {
    try {
      setBusyKey(cle);
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setBusyKey(null);
    }
  };

  const fondateur: LigneMouvement = {
    id: `${contrat.id}-fondateur`,
    type: contrat.typeAffaire ?? "Affaire Nouvelle",
    statut: "Appliqué",
    description: "Mise en place du contrat.",
    dateEffet: contrat.dateDebut,
    primeApres: contrat.prime,
    estFondateur: true,
  };
  const lignesMouvement: LigneMouvement[] = avenants
    ? [fondateur, ...avenants.map((a) => ({
        id: a.id, type: a.type, statut: a.statut, description: a.description, dateEffet: a.dateEffet,
        primeApres: a.primeApres, personnes: a.personnes, estFondateur: false,
      }))]
    : [];

  return (
    <div className="p-6">
      <button type="button" onClick={onRetour} className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />Retour à mes contrats
      </button>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/12 rounded-xl"><FileText className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-[1.35rem] font-bold text-foreground">{numeroPolice(contrat)}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{contrat.compagnie} · {contrat.branche}</p>
          </div>
        </div>
        <Badge variant={statutVariant(contrat.statut)}>{contrat.statut}</Badge>
      </div>

      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {ONGLETS.map((o) => {
          const Icon = o.icon;
          const active = onglet === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOnglet(o.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium rounded-lg whitespace-nowrap border transition-colors flex-shrink-0 ${active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {o.label}
            </button>
          );
        })}
      </div>

      {onglet === "general" && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
            <div><div className="text-[11px] text-muted-foreground">Branche</div><div className="text-foreground font-medium">{contrat.branche}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Statut</div><Badge variant={statutVariant(contrat.statut)}>{contrat.statut}</Badge></div>
            <div><div className="text-[11px] text-muted-foreground">Type d'affaire</div><div className="text-foreground font-medium">{contrat.typeAffaire ?? "—"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Date d'effet</div><div className="text-foreground font-medium">{contrat.dateDebut}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Date d'échéance</div><div className="text-foreground font-medium">{contrat.dateFin}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Périodicité</div><div className="text-foreground font-medium">{contrat.periodicite ?? "—"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Prime</div><div className="text-foreground font-medium">{fmtM(contrat.prime)} FCFA</div></div>
            <div><div className="text-[11px] text-muted-foreground">Exercice en cours</div><div className="text-foreground font-medium">N° {contrat.exerciceNumero ?? "—"}</div></div>
            <div><div className="text-[11px] text-muted-foreground">Compagnie</div><div className="text-foreground font-medium">{contrat.compagnie}</div></div>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-foreground mb-2.5">Garanties ({contrat.garanties?.length ?? 0})</h3>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-4 py-2.5">Catégorie</th>
                    <th className="text-left px-4 py-2.5">Libellé</th>
                    <th className="text-left px-4 py-2.5">Taux assuré</th>
                    <th className="text-left px-4 py-2.5">Taux ayants droit</th>
                    <th className="text-left px-4 py-2.5">Plafond</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(contrat.garanties ?? []).map((g) => (
                    <tr key={g.id} className="hover:bg-secondary/25">
                      <td className="px-4 py-2.5 text-muted-foreground">{g.categorie}</td>
                      <td className="px-4 py-2.5 text-foreground font-medium">{g.libelle}</td>
                      <td className="px-4 py-2.5 text-foreground">{g.tauxAssure !== null ? `${g.tauxAssure}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-foreground">{g.tauxAyantsDroit !== null ? `${g.tauxAyantsDroit}%` : "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.plafondMontant !== null ? `${fmtM(g.plafondMontant)} FCFA` : g.plafond ?? "—"}</td>
                    </tr>
                  ))}
                  {(contrat.garanties ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucune garantie renseignée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {onglet === "mouvements" && (
        <div className="space-y-3">
          <p className="text-[12px] text-muted-foreground">Mise en place puis chaque avenant appliqué sur ce contrat.</p>
          {avenants === null ? (
            <p className="text-[12px] text-muted-foreground py-6 text-center">Chargement…</p>
          ) : (
            <div className="space-y-2">
              {lignesMouvement.map((ligne) => {
                const ouverte = expandedId === ligne.id;
                return (
                  <div key={ligne.id} className="rounded-lg border border-border overflow-hidden bg-card">
                    <button
                      type="button"
                      onClick={() => setExpandedId(ouverte ? null : ligne.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary/30"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <Badge variant={ligne.estFondateur ? "gold" : AVENANT_STATUT_VARIANT[ligne.statut] ?? "neutral"}>{ligne.type}</Badge>
                        {!ligne.estFondateur && <Badge variant={AVENANT_STATUT_VARIANT[ligne.statut] ?? "neutral"}>{ligne.statut}</Badge>}
                        <span className="text-[12px] text-foreground truncate">{ligne.description}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {ligne.primeApres !== undefined && <span className="text-[12px] text-muted-foreground med-num">{fmtM(ligne.primeApres)}</span>}
                        <span className="text-[11px] text-muted-foreground med-num">{ligne.dateEffet}</span>
                        {ouverte ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>
                    {ouverte && (
                      <div className="px-3 py-3 border-t border-border bg-secondary/10 space-y-3">
                        {ligne.personnes && ligne.personnes.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{ligne.personnes.length} personne(s) concernée(s)</div>
                            {ligne.personnes.map((p) => (
                              <div key={p.id} className="flex items-center justify-between px-2.5 py-1 rounded bg-card text-[11.5px]">
                                <span className="text-foreground inline-flex items-center gap-1.5">
                                  {p.action === "Incorporation" ? <UserPlus className="w-3 h-3 text-emerald-600" /> : <UserMinus className="w-3 h-3 text-amber-600" />}
                                  {p.nom} {p.prenom ?? ""}
                                </span>
                                <span className="text-muted-foreground">{p.typeAssure ?? "—"} · {p.action}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {ligne.estFondateur ? (
                            <>
                              <button type="button" disabled={busyKey === `${ligne.id}-q`} onClick={() => telecharger(`${ligne.id}-q`, () => openContratDocumentClient(contrat.id, "quittance"))} className="h-8 px-3 rounded-lg border border-border text-[11.5px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Quittance</button>
                              <button type="button" disabled={busyKey === `${ligne.id}-t`} onClick={() => telecharger(`${ligne.id}-t`, () => openContratDocumentClient(contrat.id, "tableau-garanties"))} className="h-8 px-3 rounded-lg border border-border text-[11.5px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Tableau de garanties</button>
                            </>
                          ) : (
                            <>
                              <button type="button" disabled={busyKey === `${ligne.id}-qa`} onClick={() => telecharger(`${ligne.id}-qa`, () => openAvenantDocumentClient(ligne.id, "quittance"))} className="h-8 px-3 rounded-lg border border-border text-[11.5px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Quittance avenant</button>
                              <button type="button" disabled={busyKey === `${ligne.id}-a`} onClick={() => telecharger(`${ligne.id}-a`, () => openAvenantDocumentClient(ligne.id, "avenant"))} className="h-8 px-3 rounded-lg border border-border text-[11.5px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Avenant</button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {onglet === "factures" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-4 py-2.5">N°</th>
                <th className="text-left px-4 py-2.5">Date d'émission</th>
                <th className="text-left px-4 py-2.5">Objet</th>
                <th className="text-left px-4 py-2.5">Montant</th>
                <th className="text-left px-4 py-2.5">Statut</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {factures === null ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
              ) : factures.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune facture de production émise pour ce contrat.</td></tr>
              ) : (
                factures.map((f) => {
                  const montant = f.lignes.reduce((s, l) => s + Number(l.montant), 0);
                  return (
                    <tr key={f.id} className="hover:bg-secondary/25">
                      <td className="px-4 py-2.5 text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{f.numero}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{f.dateEmission}</td>
                      <td className="px-4 py-2.5 text-foreground">{f.objet}</td>
                      <td className="px-4 py-2.5 text-foreground font-medium">{fmtM(montant)} FCFA</td>
                      <td className="px-4 py-2.5"><Badge variant={f.statut === "Réglée" ? "success" : "neutral"}>{f.statut}</Badge></td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={busyKey === f.id}
                          onClick={() => telecharger(f.id, () => openFactureProductionDocumentClient(f.id))}
                          className="text-muted-foreground hover:text-primary disabled:opacity-50"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {onglet === "exercices" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-4 py-2.5">Exercice</th>
                <th className="text-left px-4 py-2.5">Période</th>
                <th className="text-left px-4 py-2.5">Périodicité</th>
                <th className="text-left px-4 py-2.5">Prime</th>
                <th className="text-left px-4 py-2.5">Compagnie</th>
                <th className="text-left px-4 py-2.5">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {exercices === null ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
              ) : exercices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun exercice enregistré.</td></tr>
              ) : (
                exercices.map((e) => (
                  <tr key={e.id} className="hover:bg-secondary/25">
                    <td className="px-4 py-2.5 text-foreground font-semibold">N° {e.numero}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.dateDebut} → {e.dateFin}</td>
                    <td className="px-4 py-2.5 text-foreground">{e.periodicite}</td>
                    <td className="px-4 py-2.5 text-foreground font-medium">{fmtM(Number(e.prime))} FCFA</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.compagnie?.nom ?? "—"}</td>
                    <td className="px-4 py-2.5"><Badge variant={e.statut === "Actif" ? "success" : "neutral"}>{e.statut}</Badge></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
