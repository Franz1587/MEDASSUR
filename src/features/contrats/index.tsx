import { useEffect, useState } from "react";
import { FileText, Filter, Plus, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { getContrats } from "@/services/contrats.service";
import type { Contrat } from "@/types/contrats";

export default function ContratsView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const statuts = ["Tous", "Actif", "En renouvellement", "Expiré"];

  useEffect(() => {
    getContrats().then(setContrats);
  }, []);

  const filtered = statusFilter === "Tous" ? contrats : contrats.filter((c) => c.statut === statusFilter);

  return (
    <div className="p-6">
      <ModuleHeader title="Production — Contrats" subtitle="Gestion des polices d'assurance en portefeuille" icon={FileText}
        actions={
          <>
            <Btn variant="secondary"><Filter className="w-4 h-4" />Filtres avancés</Btn>
            <Btn variant="primary"><Plus className="w-4 h-4" />Nouveau contrat</Btn>
          </>
        }
      />
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {statuts.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {s}
            {s !== "Tous" && <span className="text-xs opacity-70">{contrats.filter((c) => c.statut === s).length}</span>}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["N° Police", "Client", "Branche", "Compagnie", "Période", "Prime Annuelle", "Échéance", "Statut", ""].map((h) => (
                <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{c.id}</td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{c.client}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.branche}</td>
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{c.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {c.dateDebut} → {c.dateFin}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(c.prime)}</td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <span className={`text-xs font-semibold ${c.jours.includes("15") ? "text-red-400" : c.jours.includes("60") ? "text-amber-400" : "text-muted-foreground"}`} style={{ fontFamily: "'DM Mono', monospace" }}>
                    {c.jours}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge variant={c.statut === "Actif" ? "success" : c.statut === "En renouvellement" ? "warning" : c.statut === "Expiré" ? "danger" : "neutral"}>{c.statut}</Badge>
                </td>
                <td className="px-4 py-3">
                  <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
