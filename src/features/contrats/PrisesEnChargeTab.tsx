import { useEffect, useState } from "react";
import { ClipboardCheck, Download, FileCheck2, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/StatCard";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { fmtM } from "@/lib/format";
import { getAccordsPrealablesContrat } from "@/services/accordPrealable.service";
import { openAccordPrealableExport, type DocumentFormat } from "@/services/documents.service";
import type { Contrat } from "@/types/contrats";
import type { AccordPrealable } from "@/types/accordPrealable";

const DECISION_BADGE: Record<string, BadgeVariant> = { "Accordé": "success", "Refusé": "danger", "En attente": "warning" };

interface Props {
  contrat: Contrat;
}

// Prises en Charge (Entente Préalable) d'un contrat — modèle AccordPrealable,
// terme métier "Prise en Charge" au sens autorisation préalable de soins, à
// ne pas confondre avec l'onglet Consommations (factures réglées par les
// prestataires, modèle PriseEnCharge — deux notions distinctes malgré le nom
// proche du second modèle).
export default function PrisesEnChargeTab({ contrat }: Props) {
  const [accords, setAccords] = useState<AccordPrealable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAccordsPrealablesContrat(contrat.id).then(setAccords).finally(() => setLoading(false));
  }, [contrat.id]);

  const totalMontantAutorise = accords.reduce((s, a) => s + (a.montantAutorise ?? 0), 0);
  const enAttente = accords.filter((a) => a.decision === "En attente").length;

  const exporter = (format: DocumentFormat) => {
    openAccordPrealableExport(contrat.id, format).catch(() => toast.error(`Export ${format.toUpperCase()} impossible.`));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[12px] text-muted-foreground flex-1 min-w-[240px]">
          Dossiers d'Entente Préalable (Prises en Charge) de ce contrat — autorisation de soins avant leur réalisation, distincte des factures déjà réglées (onglet Consommations).
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
            <StatCard title="Dossiers" value={String(accords.length)} icon={ClipboardCheck} />
            <StatCard title="Montant autorisé total" value={fmtM(totalMontantAutorise)} icon={FileCheck2} />
            <StatCard title="En attente de décision" value={String(enAttente)} icon={Hourglass} accent="bg-amber-500/15" />
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            {accords.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4">Aucun dossier d'entente préalable sur ce contrat.</p>
            ) : (
              <table className="w-full text-[12px]">
                <thead className="bg-secondary/30">
                  <tr className="text-[10px] text-muted-foreground uppercase">
                    <th className="text-left px-3 py-2">Dossier</th>
                    <th className="text-left px-3 py-2">Assuré</th>
                    <th className="text-left px-3 py-2">Prestataire</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Date demande</th>
                    <th className="text-left px-3 py-2">Décision</th>
                    <th className="text-right px-3 py-2">Montant autorisé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {accords.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 text-primary font-semibold med-num">{a.id}</td>
                      <td className="px-3 py-2 text-foreground">{a.assureNom}</td>
                      <td className="px-3 py-2 text-foreground">{a.prestataire}</td>
                      <td className="px-3 py-2 text-foreground">{a.type}</td>
                      <td className="px-3 py-2 text-muted-foreground med-num">{a.dateDemande}</td>
                      <td className="px-3 py-2"><Badge variant={DECISION_BADGE[a.decision] ?? "neutral"}>{a.decision}</Badge></td>
                      <td className="px-3 py-2 text-right med-num text-foreground">{a.montantAutorise != null ? fmtM(a.montantAutorise) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
