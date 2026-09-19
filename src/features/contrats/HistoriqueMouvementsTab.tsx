import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getAvenants } from "@/services/avenants.service";
import { openQuittance, openQuittanceAvenant, openTableauGaranties, openAvenantDocument, openListeMouvement, type DocumentFormat } from "@/services/documents.service";
import type { Contrat } from "@/types/contrats";
import type { Avenant } from "@/types/avenants";

const statutVariant: Record<string, "neutral" | "info" | "success"> = {
  "Brouillon": "neutral",
  "Validé": "info",
  "Appliqué": "success",
};

const FORMATS: { id: DocumentFormat; label: string }[] = [
  { id: "pdf", label: "PDF" },
  { id: "xlsx", label: "Excel" },
  { id: "docx", label: "Word" },
];

// Ligne "événement" de l'historique — soit la mise en place du contrat
// (synthétique : pas une ligne Avenant en base, mais avec sa propre
// Quittance + Tableau de garanties), soit un vrai avenant.
interface LigneHistorique {
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
}

// Historique des mouvements d'un contrat — remplace l'onglet "Calcul de la
// prime" une fois le contrat déjà créé (la prime ne se fixe qu'à la mise en
// place ou lors d'un mouvement, jamais en modifiant directement la fiche) et
// fusionne l'ancien onglet "Documents" : chaque document se rattache
// désormais à son mouvement d'origine plutôt qu'à des boutons globaux.
export default function HistoriqueMouvementsTab({ contrat }: Props) {
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    getAvenants()
      .then((all) => setAvenants(all.filter((a) => a.contrat === contrat.id)))
      .finally(() => setLoading(false));
  }, [contrat.id]);

  const fondateur: LigneHistorique = {
    id: `${contrat.id}-fondateur`,
    type: contrat.typeAffaire ?? "Affaire Nouvelle",
    statut: "Appliqué",
    description: "Mise en place du contrat.",
    dateEffet: contrat.dateDebut,
    primeApres: contrat.prime,
    estFondateur: true,
  };
  const lignes: LigneHistorique[] = [
    fondateur,
    ...[...avenants]
      .sort((a, b) => a.dateEffet.localeCompare(b.dateEffet))
      .map((a) => ({
        id: a.id, type: a.type, statut: a.statut, description: a.description, dateEffet: a.dateEffet,
        primeApres: a.primeApres, personnes: a.personnes, estFondateur: false,
      })),
  ];

  const ouvrir = async (action: () => Promise<void>, cle: string) => {
    try {
      setBusyKey(cle);
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de génération du document.");
    } finally {
      setBusyKey(null);
    }
  };

  const documentsDe = (ligne: LigneHistorique): { label: string; action: (format: DocumentFormat) => Promise<void> }[] => {
    if (ligne.estFondateur) {
      return [
        { label: "Quittance", action: (f) => openQuittance(contrat.id, f) },
        { label: "Tableau de garanties", action: (f) => openTableauGaranties(contrat.id, f) },
      ];
    }
    const docs = [
      { label: "Quittance avenant", action: (f: DocumentFormat) => openQuittanceAvenant(ligne.id, f) },
      { label: "Avenant", action: (f: DocumentFormat) => openAvenantDocument(ligne.id, f) },
    ];
    if (ligne.type === "Renouvellement") {
      docs.push({ label: "Tableau de garanties", action: (f: DocumentFormat) => openTableauGaranties(contrat.id, f) });
    }
    // Liste des assurés FIGÉE de ce mouvement (2026-09) — voir demande
    // utilisateur : "si on fait une affaire nouvelle par exemple, on doit
    // avoir une liste liée à cette opération... doit pouvoir être éditée
    // plusieurs fois... et retrouver la même liste à l'identique. C'est la
    // même chose pour une incorporation ou un retrait." Seulement pour les
    // mouvements qui déplacent réellement des personnes (Incorporation/
    // Retrait — un Renouvellement/Ajustement de Prime n'en déplace aucune).
    if (ligne.type === "Incorporation" || ligne.type === "Retrait") {
      docs.push({ label: "Liste des assurés", action: (f: DocumentFormat) => openListeMouvement(ligne.id, f) });
    }
    return docs;
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        Mise en place puis chaque avenant appliqué sur ce contrat. Cliquez sur un mouvement pour accéder à ses documents — chacun téléchargeable en PDF, Excel ou Word.
      </p>
      {loading ? (
        <p className="text-[12px] text-muted-foreground py-6 text-center">Chargement…</p>
      ) : (
        <div className="space-y-2">
          {lignes.map((ligne) => {
            const ouverte = expandedId === ligne.id;
            return (
              <div key={ligne.id} className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(ouverte ? null : ligne.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-secondary/30"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <Badge variant={ligne.estFondateur ? "gold" : statutVariant[ligne.statut] ?? "neutral"}>{ligne.type}</Badge>
                    {!ligne.estFondateur && <Badge variant={statutVariant[ligne.statut] ?? "neutral"}>{ligne.statut}</Badge>}
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
                            <span className="text-foreground">{p.nom} {p.prenom ?? ""}</span>
                            <span className="text-muted-foreground">{p.typeAssure ?? "—"} · {p.action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Documents</div>
                      {documentsDe(ligne).map((docItem) => (
                        <div key={docItem.label} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border/60">
                          <span className="text-[12px] text-foreground inline-flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-muted-foreground" />{docItem.label}</span>
                          <div className="flex items-center gap-1">
                            {FORMATS.map((f) => {
                              const cle = `${ligne.id}-${docItem.label}-${f.id}`;
                              return (
                                <button
                                  key={f.id}
                                  type="button"
                                  disabled={busyKey === cle}
                                  onClick={() => ouvrir(() => docItem.action(f.id), cle)}
                                  className="h-7 px-2 rounded border border-border text-[11px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <FileDown className="w-3 h-3" />{f.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
