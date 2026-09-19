import { useEffect, useState } from "react";
import { CreditCard, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import {
  getImpayes, getRecouvrementKanban, relancerImpaye, relancerTousLesImpayes, resoudreImpaye,
} from "@/services/recouvrement.service";
import type { Impaye } from "@/types/recouvrement";

const niveauStyle: Record<string, string> = {
  "Relance 1": "text-cyan-700 bg-cyan-500/12 border-cyan-500/25",
  "Relance 2": "text-amber-700 bg-amber-500/12 border-amber-500/25",
  "Mise en demeure": "text-orange-700 bg-orange-500/12 border-orange-500/25",
  "Contentieux": "text-red-700 bg-red-500/12 border-red-500/25",
};

export default function RecouvrementView() {
  const [activeTab, setActiveTab] = useState<"liste" | "kanban">("liste");
  const [impayes, setImpayes] = useState<Impaye[]>([]);
  const [kanban, setKanban] = useState<Record<string, string[]>>({});

  const refresh = () => {
    getImpayes().then(setImpayes);
    getRecouvrementKanban().then(setKanban);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleRelancerTout = async () => {
    try {
      const { relances } = await relancerTousLesImpayes();
      refresh();
      toast.success(`${relances} dossier(s) relancé(s) au niveau supérieur.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relance impossible.");
    }
  };

  const handleRelancer = async (i: Impaye) => {
    try {
      await relancerImpaye(i.id);
      refresh();
      toast.success(`Relance envoyée pour ${i.client}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relance impossible.");
    }
  };

  const handleResoudre = async (i: Impaye) => {
    try {
      await resoudreImpaye(i.id);
      refresh();
      toast.success(`Dossier ${i.id} marqué comme résolu.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const totalDu = impayes.reduce((a, b) => a + b.montantDu, 0);
  const enCours = impayes.filter((i) => i.statut === "En cours").length;

  return (
    <div className="p-6">
      <ModuleHeader title="Recouvrement" subtitle="Gestion des impayés et relances multi-canaux" icon={CreditCard}
        actions={<Btn variant="primary" onClick={handleRelancerTout}><Send className="w-4 h-4" />Lancer une relance</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="Total impayés" value={`${fmtM(totalDu)} FCFA`} icon={CreditCard} accent="bg-red-500/10" />
        <StatCard title="Dossiers en cours" value={String(enCours)} icon={CreditCard} />
        <StatCard title="Résolus ce mois" value={String(impayes.filter((i) => i.statut === "Résolu").length)} icon={CreditCard} accent="bg-green-500/10" />
        <StatCard title="Transmis contentieux" value={String(impayes.filter((i) => i.niveau === "Contentieux").length)} icon={CreditCard} accent="bg-orange-500/10" />
      </div>
      <div className="flex gap-2 mb-5">
        {(["liste", "kanban"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm rounded-xl transition-colors font-semibold ${activeTab === t ? "bg-primary text-primary-foreground shadow-[0_8px_18px_rgba(13,115,191,0.22)]" : "bg-card/90 border border-border text-muted-foreground"}`}
          >
            {t === "liste" ? "Liste des impayés" : "Vue par niveau de relance"}
          </button>
        ))}
      </div>

      {activeTab === "liste" ? (
        <div className="bg-card/92 border border-border/80 rounded-2xl overflow-x-auto shadow-[0_10px_24px_rgba(17,66,102,0.08)]">
          <table className="w-full text-sm med-data-table">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap med-sticky-col">Réf.</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Client</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Contrat</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Montant dû</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Retard</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Niveau</th>
                <th className="hidden md:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Canal</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {impayes.map((i) => (
                <tr key={i.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-xs font-semibold text-primary whitespace-nowrap med-num med-col-ref med-sticky-col">
                    {i.id}
                    <div className="md:hidden mt-1 space-y-0.5 text-[10px] leading-4 text-muted-foreground whitespace-normal">
                      <p className="med-num text-foreground">{fmtM(i.montantDu)} FCFA</p>
                      <p>{i.statut}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{i.client}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num med-col-ref">{i.contrat}</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap med-num med-col-money">{fmtM(i.montantDu)}</td>
                  <td className="px-4 py-3 text-center whitespace-nowrap med-col-days">
                    <span className={`text-xs font-semibold med-num ${i.joursRetard > 30 ? "text-red-600" : "text-amber-600"}`}>{i.joursRetard} j</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${niveauStyle[i.niveau]}`}>{i.niveau}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{i.canal}</td>
                  <td className="px-4 py-3 whitespace-nowrap med-col-status"><Badge variant={i.statut === "Résolu" ? "success" : i.statut === "Transmis" ? "danger" : "warning"}>{i.statut}</Badge></td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {i.statut !== "Résolu" && (
                      <div className="flex items-center gap-1.5">
                        {i.niveau !== "Contentieux" && (
                          <button type="button" onClick={() => handleRelancer(i)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Relancer</button>
                        )}
                        <button type="button" onClick={() => handleResoudre(i)} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] hover:opacity-90">Résoudre</button>
                      </div>
                    )}
                  </td>
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
                <div className={`px-3 py-2 rounded-xl mb-3 border text-xs font-semibold flex items-center justify-between ${niveauStyle[niveau]}`}>
                  <span>{niveau}</span>
                  <span className="opacity-70 font-mono">{ids.length}</span>
                </div>
                <div className="space-y-2">
                  {ids.map((id) => {
                    const i = impayes.find((x) => x.id === id);
                    return (
                      <div key={id} className="bg-card/92 border border-border rounded-xl p-3 cursor-pointer hover:border-primary/35 transition-colors">
                        <p className="text-xs font-semibold text-primary mb-1 med-num">{id}</p>
                        <p className="text-xs text-foreground font-medium">{i?.client}</p>
                        {i && <p className="text-xs font-semibold text-foreground mt-1.5 med-num">{fmtM(i.montantDu)} FCFA</p>}
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


