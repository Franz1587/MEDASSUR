import { useEffect, useState } from "react";
import { CreditCard, Send } from "lucide-react";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { getImpayes, getRecouvrementKanban } from "@/services/recouvrement.service";
import type { Impaye } from "@/types/recouvrement";

const niveauStyle: Record<string, string> = {
  "Relance 1": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Relance 2": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Mise en demeure": "text-orange-400 bg-orange-500/10 border-orange-500/20",
  "Contentieux": "text-red-400 bg-red-500/10 border-red-500/20",
};

export default function RecouvrementView() {
  const [activeTab, setActiveTab] = useState<"liste" | "kanban">("liste");
  const [impayes, setImpayes] = useState<Impaye[]>([]);
  const [kanban, setKanban] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getImpayes().then(setImpayes);
    getRecouvrementKanban().then(setKanban);
  }, []);

  const totalDu = impayes.reduce((a, b) => a + b.montantDu, 0);
  const enCours = impayes.filter((i) => i.statut === "En cours").length;

  return (
    <div className="p-6">
      <ModuleHeader title="Recouvrement" subtitle="Gestion des impayés et relances multi-canaux" icon={CreditCard}
        actions={<Btn variant="primary"><Send className="w-4 h-4" />Lancer une relance</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Total impayés" value={`${fmtM(totalDu)} XAF`} icon={CreditCard} accent="bg-red-500/10" />
        <StatCard title="Dossiers en cours" value={String(enCours)} icon={CreditCard} />
        <StatCard title="Résolus ce mois" value={String(impayes.filter((i) => i.statut === "Résolu").length)} icon={CreditCard} accent="bg-green-500/10" />
        <StatCard title="Transmis contentieux" value={String(impayes.filter((i) => i.niveau === "Contentieux").length)} icon={CreditCard} accent="bg-orange-500/10" />
      </div>
      <div className="flex gap-2 mb-5">
        {(["liste", "kanban"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
          >
            {t === "liste" ? "Liste des impayés" : "Vue par niveau de relance"}
          </button>
        ))}
      </div>

      {activeTab === "liste" ? (
        <div className="bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {["Réf.", "Client", "Contrat", "Montant dû", "Retard", "Niveau", "Canal", "Statut"].map((h) => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {impayes.map((i) => (
                <tr key={i.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{i.id}</td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{i.client}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{i.contrat}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(i.montantDu)}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <span className={`text-xs font-semibold ${i.joursRetard > 30 ? "text-red-400" : "text-amber-400"}`} style={{ fontFamily: "'DM Mono', monospace" }}>{i.joursRetard} j</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${niveauStyle[i.niveau]}`}>{i.niveau}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{i.canal}</td>
                  <td className="px-4 py-3 whitespace-nowrap"><Badge variant={i.statut === "Résolu" ? "success" : i.statut === "Transmis" ? "danger" : "warning"}>{i.statut}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {Object.entries(kanban).map(([niveau, ids]) => (
              <div key={niveau} className="w-56 flex-shrink-0">
                <div className={`px-3 py-2 rounded-lg mb-3 border text-xs font-semibold flex items-center justify-between ${niveauStyle[niveau]}`}>
                  <span>{niveau}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const i = impayes.find((x) => x.id === id);
                    return (
                      <div key={id} className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors">
                        <p className="text-xs font-semibold text-primary mb-1" style={{ fontFamily: "'DM Mono', monospace" }}>{id}</p>
                        <p className="text-xs text-foreground font-medium">{i?.client}</p>
                        {i && <p className="text-xs font-semibold text-foreground mt-1.5" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(i.montantDu)} XAF</p>}
                      </div>
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
}
