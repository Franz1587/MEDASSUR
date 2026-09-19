import { useEffect, useState } from "react";
import { RefreshCw, Send, Mail, List, Clock3, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { StatCard } from "@/components/shared/StatCard";
import { fmtM } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import { useShellNavigation } from "@/layout/ShellNavigationContext";
import {
  getRenouvellements, relancerRenouvellement, relancerTousLesRenouvellements,
  marquerRenouvellementPerdu,
} from "@/services/renouvellements.service";
import { openAvisEcheance, type DocumentFormat } from "@/services/documents.service";
import type { Renouvellement } from "@/types/renouvellements";

// Clé sessionStorage utilisée pour faire atterrir le gestionnaire, après un
// clic sur "Renouveler", directement sur l'avenant de renouvellement
// correspondant dans l'écran Avenants (même avenant — Renouvellement est un
// TYPE d'Avenant, pas une table séparée, voir renouvellements.service.ts
// côté backend) — consommée une seule fois par AvenantsView.
const CLE_AVENANT_A_OUVRIR = "medassur:open-avenant";

const statutVariant: Record<string, "warning" | "info" | "success" | "danger"> = {
  "À renouveler": "warning",
  "Relancé": "info",
  "Renouvelé": "success",
  "Perdu": "danger",
};

export default function RenouvellementsView() {
  const { currentUser } = useAuth();
  const { setView } = useShellNavigation();
  const [items, setItems] = useState<Renouvellement[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");
  const statuts = ["Tous", "À renouveler", "Relancé", "Renouvelé", "Perdu"];

  const refresh = () => getRenouvellements().then(setItems);

  useEffect(() => {
    refresh();
  }, []);

  const handleRelancerTout = async () => {
    try {
      const { relances } = await relancerTousLesRenouvellements();
      refresh();
      toast.success(`${relances} avis d'échéance prêt(s) — à consulter/imprimer depuis la liste.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relance impossible.");
    }
  };

  const handleRelancer = async (r: Renouvellement) => {
    try {
      await relancerRenouvellement(r.id);
      refresh();
      toast.success(`Avis d'échéance prêt pour ${r.client}.`);
      openAvisEcheance(r.clientId, "pdf").catch(() => toast.error("Ouverture de l'avis d'échéance impossible."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Relance impossible.");
    }
  };

  // Un renouvellement ne se flip plus directement en "Renouvelé" — le
  // gestionnaire est envoyé sur l'écran Avenants pour produire un vrai
  // avenant de renouvellement (le voir, l'ajuster, le Valider, puis
  // "Appliquer au contrat"), pas juste sauter l'étape (voir AvenantsView).
  const handleRenouveler = (r: Renouvellement) => {
    sessionStorage.setItem(CLE_AVENANT_A_OUVRIR, r.id);
    setView("avenants");
  };

  const handlePerdu = async (r: Renouvellement) => {
    const ok = window.confirm(`Marquer le renouvellement de ${r.client} comme perdu ? Une demande de résiliation sera créée pour ce contrat.`);
    if (!ok) return;
    try {
      await marquerRenouvellementPerdu(r.id, currentUser?.nom);
      refresh();
      toast.success("Renouvellement marqué comme perdu — résiliation créée (en attente de validation).");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action impossible.");
    }
  };

  const exporterAvis = (r: Renouvellement, format: DocumentFormat) => {
    openAvisEcheance(r.clientId, format).catch(() => toast.error(`Export ${format.toUpperCase()} impossible.`));
  };

  const filtered = statusFilter === "Tous" ? items : items.filter((i) => i.statut === statusFilter);
  const statusIcon: Record<string, React.ElementType> = {
    "Tous": List,
    "À renouveler": Clock3,
    "Relancé": Mail,
    "Renouvelé": CheckCircle2,
    "Perdu": XCircle,
  };
  const aRenouveler = items.filter((i) => i.statut === "À renouveler").length;
  const tauxRenouvellement = items.length
    ? Math.round((items.filter((i) => i.statut === "Renouvelé").length / items.length) * 100)
    : 0;

  return (
    <div className="p-6">
      <ModuleHeader title="Renouvellements" subtitle="Suivi proactif des échéances et de la fidélisation portefeuille" icon={RefreshCw}
        actions={<Btn variant="primary" onClick={handleRelancerTout}><Send className="w-4 h-4" />Lancer les relances</Btn>}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard title="À renouveler" value={String(aRenouveler)} subtitle="Sous 30 jours" icon={RefreshCw} accent="bg-amber-500/10" />
        <StatCard title="Taux de renouvellement" value={`${tauxRenouvellement}%`} subtitle={`Portefeuille ${new Date().getFullYear()}`} icon={RefreshCw} />
        <StatCard title="Prime à renégocier" value={fmtM(items.reduce((a, b) => a + (b.statut === "À renouveler" ? b.primeProposee : 0), 0))} subtitle="FCFA cumulés" icon={RefreshCw} />
        <StatCard title="Relances envoyées" value={String(items.filter((i) => i.statut === "Relancé").length)} subtitle="Ce mois" icon={Mail} />
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {statuts.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors inline-flex items-center gap-2 ${statusFilter === s ? "bg-primary text-primary-foreground font-semibold" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            {(() => {
              const Icon = statusIcon[s] ?? RefreshCw;
              return <Icon className="w-4 h-4" />;
            })()}
            {s}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm med-data-table">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap med-sticky-col">Réf.</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Client</th>
              <th className="hidden md:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Branche</th>
              <th className="hidden lg:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Compagnie</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Échéance</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Jours</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Prime actuelle</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Prime proposée</th>
              <th className="hidden lg:table-cell text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Sinistralité</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Statut</th>
              <th className="text-left text-xs text-muted-foreground font-semibold uppercase tracking-wide px-4 py-3 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 text-primary text-xs font-semibold whitespace-nowrap med-num med-col-ref med-sticky-col">
                  {r.id}
                  <div className="md:hidden mt-1 space-y-0.5 text-[10px] leading-4 text-muted-foreground whitespace-normal">
                    <p className="med-num text-foreground">{fmtM(r.primeProposee)} FCFA</p>
                    <p>{r.statut}</p>
                  </div>
                </td>
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{r.client}</td>
                <td className="hidden md:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">{r.branche}</td>
                <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground whitespace-nowrap">{r.compagnie}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap med-num med-col-date">{r.dateFin}</td>
                <td className="px-4 py-3 whitespace-nowrap med-col-days">
                  <span className={`text-xs font-semibold med-num ${r.joursRestants < 0 ? "text-red-400" : r.joursRestants <= 15 ? "text-amber-400" : "text-muted-foreground"}`}>
                    {r.joursRestants < 0 ? "Échu" : `${r.joursRestants} j`}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-foreground whitespace-nowrap med-num med-col-money">{fmtM(r.primeActuelle)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap med-num med-col-money">{fmtM(r.primeProposee)}</td>
                <td className="hidden lg:table-cell px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap med-num">{r.sinistralite}</td>
                <td className="px-4 py-3 whitespace-nowrap med-col-status"><Badge variant={statutVariant[r.statut] ?? "neutral"}>{r.statut}</Badge></td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {(r.statut === "À renouveler" || r.statut === "Relancé") && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {r.statut === "À renouveler" && (
                          <button type="button" onClick={() => handleRelancer(r)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-foreground hover:bg-secondary/45">Relancer</button>
                        )}
                        <button type="button" onClick={() => handleRenouveler(r)} className="h-7 px-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] hover:opacity-90">Renouveler</button>
                        <button type="button" onClick={() => handlePerdu(r)} className="h-7 px-2.5 rounded-lg border border-destructive/40 text-[11px] text-destructive hover:bg-destructive/10">Perdu</button>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        {(["pdf", "xlsx", "docx"] as const).map((f) => (
                          <button key={f} type="button" onClick={() => exporterAvis(r, f)} className="text-[11px] text-primary hover:underline px-1">
                            {f === "pdf" ? "PDF" : f === "xlsx" ? "Excel" : "Word"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


