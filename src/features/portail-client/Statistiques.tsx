import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Search, Calendar, Users, TrendingUp, User, Building2, PieChart as PieChartIcon, Scale, Download,
} from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { Btn } from "@/components/shared/Btn";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getMesContrats, getMesStatistiques, openMesStatistiquesPdf, type StatistiquesPayloadClient } from "@/services/portailClient.service";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

type RubriqueId = "mois" | "famille" | "top20" | "beneficiaire" | "prestataire" | "rubrique" | "sp";

const RUBRIQUES: { id: RubriqueId; label: string; icon: React.ElementType }[] = [
  { id: "mois", label: "Consommation par mois", icon: Calendar },
  { id: "famille", label: "Consommation par Famille", icon: Users },
  { id: "top20", label: "Top 20 des Consommateurs", icon: TrendingUp },
  { id: "beneficiaire", label: "Consommation par Type Bénéficiaire", icon: User },
  { id: "prestataire", label: "Consommation par Prestataire", icon: Building2 },
  { id: "rubrique", label: "Consommation par Rubrique", icon: PieChartIcon },
  // S/P (2026-08) — voir demande utilisateur : "toutes les rubriques
  // jusqu'au S/P doivent apparaître côté client, sauf l'analyse".
  { id: "sp", label: "Evolution du S/P", icon: Scale },
];

// Ratio affiché en valeur décimale (0,XX), pas en pourcentage — même
// convention que le module interne (src/features/statistiques/index.tsx
// fmtRatio) pour rester cohérent d'un écran à l'autre.
function fmtRatio(ratioPct: number): string {
  return (ratioPct / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 min-w-0">
      <p className="text-xl font-bold text-foreground truncate" style={{ fontFamily: "'IBM Plex Mono', monospace", color: accent }}>{value}</p>
      <p className="text-[12.5px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

// Tableau à largeur garantie (2026-08) — voir demande utilisateur : "il faut
// que les données s'affichent bien, pas des données coupées". min-w sur la
// table + overflow-x-auto sur son conteneur : les colonnes gardent une
// largeur lisible et défilent horizontalement plutôt que d'être écrasées.
function Tableau({ children, minWidth = 480 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="text-[12.5px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

// Statistiques de consommation du souscripteur connecté (2026-08) — voir
// demande utilisateur : "le client doit avoir accès à ses statistiques
// uniquement" / "faire de chaque rubrique un onglet d'un menu horizontal".
// Version allégée du module interne (même moteur de calcul, GET
// /portail-client/statistiques/:contratId, qui retire déjà les rubriques
// internes S/P et l'analyse stratégique — voir PortailClientController).
export default function PortailStatistiquesView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratChoisi, setContratChoisi] = useState<Contrat | null>(null);
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [data, setData] = useState<StatistiquesPayloadClient | null>(null);
  const [chargement, setChargement] = useState(false);
  const [onglet, setOnglet] = useState<RubriqueId>("mois");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    getMesContrats().then((liste) => {
      setContrats(liste);
      if (liste.length === 1) setContratChoisi(liste[0]);
    });
  }, []);

  const generer = async () => {
    if (!contratChoisi) return;
    setChargement(true);
    try {
      setData(await getMesStatistiques(contratChoisi.id, du || undefined, au || undefined));
    } finally {
      setChargement(false);
    }
  };

  const [telechargement, setTelechargement] = useState(false);
  const telecharger = async () => {
    if (!contratChoisi) return;
    setTelechargement(true);
    try {
      await openMesStatistiquesPdf(contratChoisi.id, du || undefined, au || undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setTelechargement(false);
    }
  };

  const rechercheNorm = recherche.trim().toLowerCase();
  const familleFiltree = useMemo(
    () => data?.consommationParFamille.filter((l) => !rechercheNorm || `${l.matricule} ${l.famille}`.toLowerCase().includes(rechercheNorm)) ?? [],
    [data, rechercheNorm],
  );
  const top20Filtre = useMemo(
    () => data?.top20Consommateurs.filter((l) => !rechercheNorm || `${l.matricule} ${l.famille}`.toLowerCase().includes(rechercheNorm)) ?? [],
    [data, rechercheNorm],
  );

  const moyenneMensuelle = data && data.evolutionMensuelle.length > 0
    ? data.evolutionMensuelle.reduce((s, l) => s + l.montant, 0) / data.evolutionMensuelle.length
    : 0;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.35rem] font-bold text-foreground">Statistiques</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Consommation de votre contrat</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <div className="text-[13px] font-semibold text-foreground mb-3">Filtres de recherche</div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <label className="block w-full sm:w-64">
            <div className="text-[11px] font-medium text-muted-foreground mb-1">Contrat</div>
            <Combobox options={contrats} value={contratChoisi} onChange={setContratChoisi} getLabel={(c) => numeroPolice(c)} getSubLabel={(c) => c.branche} getId={(c) => c.id} placeholder="Rechercher…" />
          </label>
          <label className="block w-full sm:w-40">
            <div className="text-[11px] font-medium text-muted-foreground mb-1">Date de début</div>
            <DateInput value={du} onChange={setDu} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
          </label>
          <label className="block w-full sm:w-40">
            <div className="text-[11px] font-medium text-muted-foreground mb-1">Date de fin</div>
            <DateInput value={au} onChange={setAu} className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
          </label>
          <Btn variant="primary" onClick={generer} disabled={!contratChoisi || chargement}><Search className="w-4 h-4" />Rechercher</Btn>
          <Btn variant="secondary" onClick={telecharger} disabled={!contratChoisi || telechargement}><Download className="w-4 h-4" />Télécharger PDF</Btn>
        </div>
      </div>

      {/* Onglets horizontaux — un par rubrique, toujours visibles (voir
          demande utilisateur : "faire apparaître les rubriques avant même
          d'afficher les données"), pas seulement une fois une recherche
          lancée. */}
      <div className="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1">
        {RUBRIQUES.map((r) => {
          const Icon = r.icon;
          const active = onglet === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setOnglet(r.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-medium rounded-lg whitespace-nowrap border transition-colors flex-shrink-0 ${active ? "border-primary bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {r.label}
            </button>
          );
        })}
      </div>

      {!data && (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">
          {chargement ? "Chargement des statistiques…" : "Sélectionnez un contrat puis cliquez sur \"Rechercher\" pour afficher les statistiques de cette rubrique."}
        </div>
      )}

      {data && (
        <>
          {onglet === "mois" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Montant total consommé" value={`${fmtM(data.totalConsomme)} FCFA`} accent="var(--chart-1)" />
                <KpiCard label="Moyenne mensuelle" value={`${fmtM(Math.round(moyenneMensuelle))} FCFA`} accent="var(--chart-2)" />
              </div>
              <Tableau minWidth={320}>
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-2">Mois</th>
                    <th className="text-right px-3 py-2">Montant consommé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.evolutionMensuelle.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-foreground">{l.label}</td>
                      <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                    </tr>
                  ))}
                  {data.evolutionMensuelle.length === 0 && (
                    <tr><td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">Aucune consommation sur la période.</td></tr>
                  )}
                  <tr className="font-semibold bg-secondary/25">
                    <td className="px-3 py-2 text-foreground">Total</td>
                    <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(data.totalConsomme)}</td>
                  </tr>
                </tbody>
              </Tableau>
              <div className="bg-card border border-border rounded-2xl p-5 mt-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.evolutionMensuelle} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => fmtM(v)} />
                      <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                      <Bar dataKey="montant" name="Consommation" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {onglet === "famille" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Familles ayant consommé" value={String(data.consommationParFamille.length)} accent="var(--chart-1)" />
                <KpiCard label="Montant total" value={`${fmtM(data.consommationParFamille.reduce((s, l) => s + l.montant, 0))} FCFA`} accent="var(--chart-2)" />
              </div>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par matricule ou nom…" className="w-full sm:w-80 h-9 px-3 mb-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
              <Tableau>
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-2">Matricule</th>
                    <th className="text-left px-3 py-2">Famille</th>
                    <th className="text-right px-3 py-2">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {familleFiltree.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{l.matricule}</td>
                      <td className="px-3 py-2 text-foreground">{l.famille}</td>
                      <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                    </tr>
                  ))}
                  {familleFiltree.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Aucune consommation sur la période.</td></tr>
                  )}
                </tbody>
              </Tableau>
              {familleFiltree.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 mt-4">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={familleFiltree.map((l) => ({ libelle: l.famille.replace(/^Famille /, ""), montant: l.montant }))} margin={{ top: 8, right: 12, bottom: 40, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="libelle" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
                        <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => fmtM(v)} />
                        <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                        <Bar dataKey="montant" name="Consommation" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {onglet === "top20" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Plus fort consommateur" value={data.top20Consommateurs[0] ? `${fmtM(data.top20Consommateurs[0].montant)} FCFA` : "—"} accent="var(--chart-1)" />
                <KpiCard label="Personnes soignées" value={String(data.totalPersonnesSoignees)} accent="var(--chart-2)" />
              </div>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher par matricule ou nom…" className="w-full sm:w-80 h-9 px-3 mb-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
              <Tableau>
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-2">Matricule</th>
                    <th className="text-left px-3 py-2">Famille</th>
                    <th className="text-right px-3 py-2">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {top20Filtre.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap" style={{ fontFamily: "'DM Mono', monospace" }}>{l.matricule}</td>
                      <td className="px-3 py-2 text-foreground">{l.famille}</td>
                      <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                    </tr>
                  ))}
                  {top20Filtre.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Aucune consommation sur la période.</td></tr>
                  )}
                </tbody>
              </Tableau>
              {top20Filtre.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 mt-4">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top20Filtre.map((l) => ({ libelle: l.famille.replace(/^Famille /, ""), montant: l.montant }))} margin={{ top: 8, right: 12, bottom: 40, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="libelle" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={60} />
                        <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => fmtM(v)} />
                        <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                        <Bar dataKey="montant" name="Consommation" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}

          {onglet === "beneficiaire" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Montant total consommé" value={`${fmtM(data.totalConsomme)} FCFA`} accent="var(--chart-1)" />
                <KpiCard label="Personnes soignées" value={String(data.totalPersonnesSoignees)} accent="var(--chart-2)" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Tableau minWidth={360}>
                  <thead>
                    <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-right px-3 py-2">Nombre</th>
                      <th className="text-right px-3 py-2">Montant</th>
                      <th className="text-right px-3 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.repartitionBeneficiaire.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-foreground whitespace-nowrap">{l.type}</td>
                        <td className="px-3 py-2 text-right text-foreground">{l.nombre}</td>
                        <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{l.pctDepenses.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Tableau>
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie data={data.repartitionBeneficiaire} dataKey="montant" nameKey="type" cx="50%" cy="50%" outerRadius={80}>
                          {data.repartitionBeneficiaire.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Légende avec pourcentage — pas d'étiquette directement sur
                      le camembert (voir demande utilisateur : les petites parts
                      faisaient se chevaucher les pourcentages sur le graphique). */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                    {data.repartitionBeneficiaire.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {l.type} <span className="text-foreground font-medium">{l.pctDepenses.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {onglet === "prestataire" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Prestataire principal" value={data.consommationParPrestataire[0]?.libelle ?? "—"} accent="var(--chart-1)" />
                <KpiCard label="Nombre de prestataires" value={String(data.consommationParPrestataire.length)} accent="var(--chart-2)" />
              </div>
              <Tableau>
                <thead>
                  <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <th className="text-left px-3 py-2">Prestataire</th>
                    <th className="text-right px-3 py-2">Montant</th>
                    <th className="text-right px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {data.consommationParPrestataire.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-foreground">{l.libelle}</td>
                      <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{l.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {data.consommationParPrestataire.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">Aucune consommation sur la période.</td></tr>
                  )}
                </tbody>
              </Tableau>
              {data.consommationParPrestataire.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 mt-4">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie data={data.consommationParPrestataire} dataKey="montant" nameKey="libelle" cx="50%" cy="50%" innerRadius={44} outerRadius={80} paddingAngle={2}>
                          {data.consommationParPrestataire.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                    {data.consommationParPrestataire.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {l.libelle}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {onglet === "rubrique" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="Rubrique principale" value={data.consommationParRubrique[0]?.libelle ?? "—"} accent="var(--chart-1)" />
                <KpiCard label="Montant total consommé" value={`${fmtM(data.totalConsomme)} FCFA`} accent="var(--chart-2)" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Tableau minWidth={360}>
                  <thead>
                    <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                      <th className="text-left px-3 py-2">Rubrique</th>
                      <th className="text-right px-3 py-2">Montant</th>
                      <th className="text-right px-3 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.consommationParRubrique.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-foreground">{l.libelle}</td>
                        <td className="px-3 py-2 text-right text-foreground whitespace-nowrap">{fmtM(l.montant)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{l.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </Tableau>
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <Pie data={data.consommationParRubrique} dataKey="montant" nameKey="libelle" cx="50%" cy="50%" outerRadius={80}>
                          {data.consommationParRubrique.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                        </Pie>
                        <Tooltip {...ChartTooltipStyle} formatter={(v: number) => `${fmtM(v)} FCFA`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Légende avec pourcentage, pas d'étiquette sur le
                      camembert — voir demande utilisateur (chevauchement des
                      pourcentages sur les petites parts). */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
                    {data.consommationParRubrique.map((l, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {l.libelle} <span className="text-foreground font-medium">{l.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {onglet === "sp" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <KpiCard label="S/P sans chargement" value={fmtRatio(data.spSansChargement.ratioPct)} accent="var(--chart-1)" />
                <KpiCard label="S/P avec chargement" value={fmtRatio(data.spAvecChargement.ratioPct)} accent="var(--chart-2)" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="text-[12.5px] font-semibold text-foreground mb-3">Sans chargement</div>
                  <dl className="space-y-2 text-[13px]">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Sinistres</dt><dd className="text-foreground font-medium">{fmtM(data.spSansChargement.sinistres)} FCFA</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Primes</dt><dd className="text-foreground font-medium">{fmtM(data.spSansChargement.primes)} FCFA</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">S/P</dt><dd className="text-foreground font-medium">{fmtRatio(data.spSansChargement.ratioPct)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Tranche</dt><dd className="text-foreground font-medium">{data.spSansChargement.tranche}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Régularisation</dt><dd className="text-foreground font-medium">{data.spSansChargement.regularisationPct}%</dd></div>
                  </dl>
                </div>
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="text-[12.5px] font-semibold text-foreground mb-3">Avec chargement</div>
                  <dl className="space-y-2 text-[13px]">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Sinistres</dt><dd className="text-foreground font-medium">{fmtM(data.spAvecChargement.sinistres)} FCFA</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Primes</dt><dd className="text-foreground font-medium">{fmtM(data.spAvecChargement.primes)} FCFA</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">S/P</dt><dd className="text-foreground font-medium">{fmtRatio(data.spAvecChargement.ratioPct)}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Tranche</dt><dd className="text-foreground font-medium">{data.spAvecChargement.tranche}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Régularisation</dt><dd className="text-foreground font-medium">{data.spAvecChargement.regularisationPct}%</dd></div>
                  </dl>
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { libelle: "Sans chargement", ratio: data.spSansChargement.ratioPct },
                        { libelle: "Avec chargement", ratio: data.spAvecChargement.ratioPct },
                      ]}
                      margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="libelle" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={(v) => fmtRatio(v)} />
                      <Tooltip {...ChartTooltipStyle} itemStyle={{ color: "#DDE6F4" }} formatter={(v: number) => fmtRatio(v)} />
                      <Bar dataKey="ratio" name="S/P" radius={[4, 4, 0, 0]} barSize={120}>
                        <Cell fill="var(--chart-1)" />
                        <Cell fill="var(--chart-2)" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
