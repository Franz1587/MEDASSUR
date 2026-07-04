import { useEffect, useState } from "react";
import { Search, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getPriseEnCharges } from "@/services/sante.service";
import { getAccordsPrealables, decider } from "@/services/accordPrealable.service";
import { getScoringsFraude, evaluerAssure } from "@/services/fraude.service";
import type { PriseEnCharge } from "@/types/sante";
import type { AccordPrealable } from "@/types/accordPrealable";
import type { ScoringFraude } from "@/types/fraude";

const controleMedicalVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  "Validé": "success", "En cours": "warning", "Rejeté": "danger", "Non requis": "neutral",
};

function PrisesEnChargeTab() {
  const [priseEnCharges, setPriseEnCharges] = useState<PriseEnCharge[]>([]);

  useEffect(() => {
    getPriseEnCharges().then(setPriseEnCharges);
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Prises en Charge ({priseEnCharges.length})</h3></div>
      <div className="p-4 space-y-3">
        {priseEnCharges.map((pc) => (
          <div key={pc.id} className="p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold text-primary" style={{ fontFamily: "'DM Mono', monospace" }}>{pc.id}</span>
                  <Badge variant={pc.type === "Hospitalisation" ? "danger" : "neutral"}>{pc.type}</Badge>
                  {pc.modePaiement && <Badge variant="info">{pc.modePaiement === "TiersPayant" ? "Tiers payant" : "Remboursement"}</Badge>}
                </div>
                <p className="text-sm font-semibold text-foreground">{pc.assure}</p>
                <p className="text-xs text-muted-foreground">{pc.prestataire}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(pc.montant)}</p>
                <div className="mt-1"><Badge variant={pc.statut === "Remboursé" ? "success" : "info"}>{pc.statut}</Badge></div>
              </div>
            </div>
            {pc.statutControleMedical && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Contrôle médical:</span>
                  <Badge variant={controleMedicalVariant[pc.statutControleMedical] ?? "neutral"}>{pc.statutControleMedical}</Badge>
                </div>
                {pc.resteACharge !== undefined && (
                  <span className="text-muted-foreground">Reste à charge: <span className="text-foreground font-semibold">{fmtM(pc.resteACharge)}</span></span>
                )}
              </div>
            )}
          </div>
        ))}
        {priseEnCharges.length === 0 && <p className="text-xs text-center text-muted-foreground py-8">Aucune prise en charge</p>}
      </div>
    </div>
  );
}

const workflowVariant: Record<string, "success" | "warning" | "danger"> = {
  "Validée": "success", "En cours": "warning", "Rejetée": "danger",
};
const decisionVariant: Record<string, "success" | "danger" | "warning"> = {
  "Accordé": "success", "Refusé": "danger", "En attente": "warning",
};

function AccordsPrealablesTab() {
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
                  {a.statutAnalyseMedicale === "En cours" && <Btn variant="ghost" onClick={() => validerAnalyse(a)}>Valider analyse</Btn>}
                  {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "En cours" && <Btn variant="ghost" onClick={() => validerFinancier(a)}>Valider finance</Btn>}
                  {a.statutAnalyseMedicale === "Validée" && a.statutValidationFinanciere === "Validée" && a.decision === "En attente" && (
                    <>
                      <button onClick={() => trancher(a, "Accordé")} className="p-1.5 rounded hover:bg-secondary text-green-400" title="Accorder"><CheckCircle className="w-4 h-4" /></button>
                      <button onClick={() => trancher(a, "Refusé")} className="p-1.5 rounded hover:bg-secondary text-red-400" title="Refuser"><XCircle className="w-4 h-4" /></button>
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
  );
}

function scoreVariant(score: number): "success" | "warning" | "danger" {
  if (score >= 50) return "danger";
  if (score >= 25) return "warning";
  return "success";
}

function ControleFraudeTab() {
  const [scores, setScores] = useState<ScoringFraude[]>([]);
  const [assureId, setAssureId] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    getScoringsFraude().then(setScores);
  }, []);

  const handleEvaluer = async () => {
    if (!assureId.trim()) return;
    setEvaluating(true);
    try {
      await evaluerAssure(assureId.trim());
      setScores(await getScoringsFraude());
      setAssureId("");
    } catch {
      window.alert("Assuré introuvable ou erreur d'évaluation");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={assureId}
          onChange={(e) => setAssureId(e.target.value)}
          placeholder="ID assuré (ex: ASS-001)"
          className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors w-56"
        />
        <Btn variant="primary" onClick={handleEvaluer}><Search className="w-4 h-4" />{evaluating ? "Évaluation…" : "Évaluer"}</Btn>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Cible", "Nom", "Score", "Motifs", "Date évaluation"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scores.map((s) => (
              <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant="gold">{s.cible}</Badge></td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{s.cibleNom}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-secondary rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full ${s.score >= 50 ? "bg-red-500" : s.score >= 25 ? "bg-amber-500" : "bg-green-500"}`} style={{ width: `${s.score}%` }} />
                    </div>
                    <Badge variant={scoreVariant(s.score)}>{s.score}/100</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-md">{s.motifs}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{s.dateEvaluation}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scores.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucune évaluation enregistrée</div>}
      </div>
    </div>
  );
}

export default function SinistresControleSection() {
  const [tab, setTab] = useState<"prises" | "accords" | "fraude">("prises");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([["prises", "Prises en charge"], ["accords", "Accords préalables"], ["fraude", "Contrôle fraude"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${tab === id ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-foreground border border-transparent"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "prises" && <PrisesEnChargeTab />}
      {tab === "accords" && <AccordsPrealablesTab />}
      {tab === "fraude" && <ControleFraudeTab />}
    </div>
  );
}
