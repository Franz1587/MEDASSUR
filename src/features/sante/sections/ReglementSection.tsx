import { useEffect, useState } from "react";
import { FileStack, Plus, CheckCircle, XCircle, Banknote } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getBordereaux, genererBordereau, validerBordereau, rejeterBordereau, payerBordereau } from "@/services/reglement.service";
import { getPrestataires } from "@/services/prestataires.service";
import type { BordereauReglement } from "@/types/reglement";
import type { Prestataire } from "@/types/prestataires";

const statutVariant: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
  "Reçu": "info", "En validation": "warning", "Validé": "success", "Payé": "success", "Rejeté": "danger",
};

export default function ReglementSection() {
  const [bordereaux, setBordereaux] = useState<BordereauReglement[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [prestataireId, setPrestataireId] = useState("");
  const [periode, setPeriode] = useState("");
  const [generating, setGenerating] = useState(false);

  const refresh = async () => setBordereaux(await getBordereaux());

  useEffect(() => {
    refresh();
    getPrestataires().then((data) => {
      setPrestataires(data);
      setPrestataireId((id) => id || data[0]?.id || "");
    });
  }, []);

  const handleGenerer = async () => {
    if (!prestataireId || !periode.trim()) return;
    setGenerating(true);
    try {
      await genererBordereau(prestataireId, periode.trim());
      await refresh();
      setPeriode("");
    } catch {
      window.alert("Aucune prise en charge non réglée pour ce prestataire sur cette période");
    } finally {
      setGenerating(false);
    }
  };

  const handleValider = async (id: string) => {
    await validerBordereau(id);
    refresh();
  };
  const handleRejeter = async (id: string) => {
    await rejeterBordereau(id);
    refresh();
  };
  const handlePayer = async (id: string) => {
    const ref = window.prompt("Référence du virement :");
    if (!ref) return;
    await payerBordereau(id, ref);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileStack className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Générer un bordereau de règlement</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={prestataireId}
            onChange={(e) => setPrestataireId(e.target.value)}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          >
            {prestataires.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          <input
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            placeholder="Période (ex: Novembre 2024)"
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors w-56"
          />
          <Btn variant="primary" onClick={handleGenerer}><Plus className="w-4 h-4" />{generating ? "Génération…" : "Générer le bordereau"}</Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-border"><h3 className="font-semibold text-foreground text-sm">Bordereaux ({bordereaux.length})</h3></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Réf.", "Prestataire", "Période", "Lignes", "Montant total", "Montant validé", "Statut", "Actions"].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bordereaux.map((b) => (
              <tr key={b.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{b.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{b.prestataireNom}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{b.periode}</td>
                <td className="px-4 py-3 text-center text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{b.nbPrisesEnCharge}</td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(b.montantTotal)}</td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{b.montantValide !== undefined ? fmtM(b.montantValide) : "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap"><Badge variant={statutVariant[b.statut] ?? "neutral"}>{b.statut}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {b.statut === "Reçu" && (
                      <>
                        <button onClick={() => handleValider(b.id)} className="p-1.5 rounded hover:bg-secondary text-green-400" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => handleRejeter(b.id)} className="p-1.5 rounded hover:bg-secondary text-red-400" title="Rejeter"><XCircle className="w-4 h-4" /></button>
                      </>
                    )}
                    {b.statut === "Validé" && (
                      <Btn variant="ghost" onClick={() => handlePayer(b.id)}><Banknote className="w-4 h-4" />Marquer payé</Btn>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bordereaux.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Aucun bordereau</div>}
      </div>
    </div>
  );
}
