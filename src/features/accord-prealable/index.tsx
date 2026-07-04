import { useEffect, useState } from "react";
import { ShieldCheck, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getAccordsPrealables, decider } from "@/services/accordPrealable.service";
import type { AccordPrealable } from "@/types/accordPrealable";

const decisionVariant: Record<string, "success" | "danger" | "warning"> = {
  "Accordé": "success",
  "Refusé": "danger",
  "En attente": "warning",
};

const workflowVariant: Record<string, "success" | "warning" | "danger"> = {
  "Validée": "success",
  "En cours": "warning",
  "Rejetée": "danger",
};

export default function AccordPrealableView() {
  const [accords, setAccords] = useState<AccordPrealable[]>([]);

  useEffect(() => {
    getAccordsPrealables().then(setAccords);
  }, []);

  const refresh = async () => setAccords(await getAccordsPrealables());

  const validerAnalyse = async (a: AccordPrealable) => {
    await decider(a.id, { statutAnalyseMedicale: "Validée" });
    refresh();
  };

  const validerFinancier = async (a: AccordPrealable) => {
    await decider(a.id, { statutValidationFinanciere: "Validée" });
    refresh();
  };

  const trancher = async (a: AccordPrealable, decision: "Accordé" | "Refusé") => {
    const montantAutorise = decision === "Accordé" ? Number(window.prompt("Montant autorisé (XAF) :", "0")) : undefined;
    await decider(a.id, { decision, montantAutorise, dateDecision: new Date().toLocaleDateString("fr-FR") });
    refresh();
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Accords Préalables" subtitle="Hospitalisation, chirurgie, EVASAN — analyse médicale et validation financière" icon={ShieldCheck} />
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Assuré", "Type", "Description", "Analyse médicale", "Validation financière", "Décision", "Montant autorisé", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accords.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{a.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{a.assureNom}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{a.type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">{a.description}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={workflowVariant[a.statutAnalyseMedicale] ?? "neutral"}>{a.statutAnalyseMedicale}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={workflowVariant[a.statutValidationFinanciere] ?? "neutral"}>{a.statutValidationFinanciere}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={decisionVariant[a.decision] ?? "neutral"}>{a.decision}</Badge></td>
                <td className="px-4 py-3 text-right text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{a.montantAutorise ? `${fmtM(a.montantAutorise)} XAF` : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {a.statutAnalyseMedicale === "En cours" && (
                      <Btn variant="ghost" onClick={() => validerAnalyse(a)}>Valider analyse</Btn>
                    )}
                    {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "En cours" && (
                      <Btn variant="ghost" onClick={() => validerFinancier(a)}>Valider finance</Btn>
                    )}
                    {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "Validée" && a.decision === "En attente" && (
                      <>
                        <button onClick={() => trancher(a, "Accordé")} className="p-1.5 rounded hover:bg-secondary text-green-400" title="Accorder">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => trancher(a, "Refusé")} className="p-1.5 rounded hover:bg-secondary text-red-400" title="Refuser">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accords.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucun accord préalable en cours</div>}
      </div>
    </div>
  );
}
