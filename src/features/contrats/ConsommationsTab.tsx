import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardCheck, Download, Receipt } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getPriseEnChargesContrat } from "@/services/sante.service";
import { openConsommationsExport, type DocumentFormat } from "@/services/documents.service";
import type { Contrat } from "@/types/contrats";
import type { PriseEnCharge } from "@/types/sante";

// Rapprochement entre une prise en charge (facture prestataire) et les
// garanties du contrat — ici uniquement pour l'affichage agrégé par
// rubrique, pas une règle bloquante.
//
// categorieGarantieActe (2026-08) — voir demande utilisateur : "Autre ça
// ne veut rien dire en assurance santé. Il faut être le plus clair et
// précis possible" : préfère ActeMedical.categorieGarantie (exact) au
// rapprochement texte ci-dessous (approximatif, et qui ne matche jamais un
// TYPES_PRESTATION comme "Ambulatoire" contre un nom de Garantie) — même
// correction que backend DocumentsService/portail-membre.util.ts. Repli sur
// le type réel de la ligne plutôt que "Autre" en dernier recours.
function resoudreCategorie(garanties: Contrat["garanties"], type: string, categorieGarantieActe?: string | null): string {
  if (categorieGarantieActe) return categorieGarantieActe;
  const t = type.trim().toLowerCase();
  if (!t) return "Autre";
  // Le type saisi sur une PEC est souvent directement le nom de la rubrique
  // (ex. "Hospitalisation", "Dentisterie") plutôt qu'un libellé précis —
  // on essaie donc d'abord la catégorie elle-même, avant le rapprochement
  // par libellé (identique à verifierPlafondPartage côté backend).
  const categorieDirecte = garanties.find((g) => g.categorie.trim().toLowerCase() === t);
  if (categorieDirecte) return categorieDirecte.categorie;
  const exact = garanties.find((g) => g.libelle.trim().toLowerCase() === t);
  if (exact) return exact.categorie;
  const partiel = garanties.find((g) => t.includes(g.libelle.trim().toLowerCase()) || g.libelle.trim().toLowerCase().includes(t));
  return partiel ? partiel.categorie : type.trim() || "Autre";
}

interface Props {
  contrat: Contrat;
}

// Consommations d'un contrat = les factures transmises par les prestataires
// du réseau de soins pour les assurés de ce contrat (modèle PriseEnCharge,
// qui porte prestataire/montant/factureRef/bordereauId) — à ne pas confondre
// avec l'Entente Préalable (module "Accord préalable"), notion distincte.
export default function ConsommationsTab({ contrat }: Props) {
  const [pec, setPec] = useState<PriseEnCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPriseEnChargesContrat(contrat.id).then(setPec).finally(() => setLoading(false));
  }, [contrat.id]);

  // Lignes Rejeté/Annulé conservées dans la liste "Détail des factures"
  // (traçabilité/audit — voir le badge de statut sur chaque ligne), mais
  // exclues des totaux/répartition par rubrique (2026-09) — voir demande
  // utilisateur : "le cumul de la police n'est pas harmonisé avec le reste
  // des données de la police". Une ligne Rejeté ou Annulé n'a jamais été
  // payée et ne doit compter dans AUCUN cumul, même règle désormais que
  // les contrôles de plafond (SanteService) et le rapport Statistiques S/P.
  const pecComptabilisees = useMemo(() => pec.filter((p) => p.statut !== "Rejeté" && p.statut !== "Annulé"), [pec]);
  const totalMontant = pecComptabilisees.reduce((s, p) => s + p.montant, 0);
  const totalResteACharge = pecComptabilisees.reduce((s, p) => s + (p.resteACharge ?? 0), 0);

  const rubriques = useMemo(() => {
    const map = new Map<string, { nombre: number; montant: number }>();
    for (const p of pecComptabilisees) {
      const cat = resoudreCategorie(contrat.garanties, p.type, p.categorieGarantieActe);
      const entree = map.get(cat) ?? { nombre: 0, montant: 0 };
      entree.nombre += 1;
      entree.montant += p.montant;
      map.set(cat, entree);
    }
    return Array.from(map.entries())
      .map(([categorie, v]) => ({ categorie, ...v }))
      .sort((a, b) => b.montant - a.montant);
  }, [pecComptabilisees, contrat.garanties]);

  const exporter = (format: DocumentFormat) => {
    openConsommationsExport(contrat.id, format).catch(() => toast.error(`Export ${format.toUpperCase()} impossible.`));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-muted-foreground flex-1 min-w-[240px]">
          Consommations de ce contrat — factures transmises par les prestataires du réseau de soins pour l'ensemble de la population affiliée, réparties par rubrique de garantie.
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
          {(["pdf", "xlsx", "docx"] as const).map((f) => (
            <button key={f} type="button" onClick={() => exporter(f)} className="text-[11px] text-primary hover:underline px-1">
              {f === "pdf" ? "PDF" : f === "xlsx" ? "Excel" : "Word"}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="text-[12px] text-muted-foreground py-6 text-center">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard title="Dossiers" value={String(pec.length)} icon={ClipboardCheck} />
            <StatCard title="Montant total" value={fmtM(totalMontant)} icon={Receipt} />
            <StatCard title="Reste à charge cumulé" value={fmtM(totalResteACharge)} icon={Receipt} accent="bg-amber-500/15" />
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Répartition par rubrique</div>
            {rubriques.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">Aucune consommation enregistrée sur ce contrat.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-secondary/30">
                    <tr className="text-[10px] text-muted-foreground uppercase">
                      <th className="text-left px-3 py-2">Rubrique</th>
                      <th className="text-right px-3 py-2">Nombre</th>
                      <th className="text-right px-3 py-2">Montant total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rubriques.map((r) => (
                      <tr key={r.categorie}>
                        <td className="px-3 py-2 text-foreground">{r.categorie}</td>
                        <td className="px-3 py-2 text-right med-num text-foreground">{r.nombre}</td>
                        <td className="px-3 py-2 text-right med-num text-foreground">{fmtM(r.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold bg-secondary/20">
                      <td className="px-3 py-2 text-foreground">TOTAL</td>
                      <td className="px-3 py-2 text-right med-num text-foreground">{pecComptabilisees.length}</td>
                      <td className="px-3 py-2 text-right med-num text-foreground">{fmtM(totalMontant)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Détail des factures</div>
            <div className="space-y-2">
              {pec.map((p) => {
                const ouverte = ouvert === p.id;
                return (
                  <div key={p.id} className="rounded-lg bg-secondary/30 overflow-hidden">
                    <button type="button" onClick={() => setOuvert(ouverte ? null : p.id)} className="w-full text-left p-3 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {ouverte ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                            <span className="text-[11px] font-semibold text-primary med-num">{p.id}</span>
                            <Badge variant="neutral">{p.type}</Badge>
                            <Badge variant="info">{p.assure}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground pl-5">{p.prestataire} · {p.date}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-foreground med-num">{fmtM(p.montant)}</p>
                          <Badge variant={p.statut === "Remboursé" ? "success" : "info"}>{p.statut}</Badge>
                        </div>
                      </div>
                    </button>
                    {ouverte && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/60 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                        <div><p className="text-muted-foreground">Mode de paiement</p><p className="text-foreground">{p.modePaiement === "TiersPayant" ? "Tiers payant" : p.modePaiement ?? "—"}</p></div>
                        <div><p className="text-muted-foreground">Reste à charge</p><p className="text-foreground">{p.resteACharge !== undefined ? fmtM(p.resteACharge) : "—"}</p></div>
                        <div><p className="text-muted-foreground">Réf. facture</p><p className="text-foreground">{p.factureRef ?? "—"}</p></div>
                      </div>
                    )}
                  </div>
                );
              })}
              {pec.length === 0 && <p className="text-xs text-center text-muted-foreground py-8">Aucune facture enregistrée sur ce contrat.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
