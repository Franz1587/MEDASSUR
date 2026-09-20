import { Fragment, useEffect, useState } from "react";
import { PieChart as PieChartIcon, Search, FileDown, FileText, ChevronRight, ChevronDown, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { ChartTooltipStyle } from "@/components/shared/chartTooltipStyle";
import { fmtM } from "@/lib/format";
import { getContrats } from "@/services/contrats.service";
import {
  getStatistiques, RUBRIQUES_STATISTIQUES, type StatistiquesPayload, type RepartitionLigne, type AnalyseNarrative,
} from "@/services/statistiques.service";
import { openStatistiques } from "@/services/documents.service";
import type { Contrat } from "@/types/contrats";

const fieldCls = "border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
// Palette de marque MedAssur (voir src/styles/theme.css --chart-1..5) — pas
// la charte du modèle de référence (voir demande utilisateur : "les
// couleurs doivent être modélisable par la première et seconde couleurs du
// site... pas rester sur le modèle de LA RUCHE EXCELLENCE").
const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "#7c9fc9", "#0e8f79", "#84c2e8"];

function pct(n: number): string {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
}

// S/P en ratio décimal, pas en pourcentage — voir demande utilisateur :
// "le ratio est de 0,0586 donc sensiblement égal à 0.06 à deux chiffres
// après la virgule".
function fmtRatio(ratioPct: number): string {
  return (ratioPct / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Recherche insensible aux accents/casse — voir demande utilisateur : "pour
// chaque rubrique... une barre de recherche ciblée qui permettra de faire
// la recherche uniquement dans la rubrique".
function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function correspond(q: string, ...champs: (string | number)[]): boolean {
  if (!q.trim()) return true;
  const nq = normaliser(q);
  return champs.some((c) => normaliser(String(c)).includes(nq));
}

// Barre de recherche compacte, propre à une rubrique — filtre uniquement
// les lignes de CETTE rubrique, sans appel serveur (tout est déjà chargé).
function RechercheRubrique({ value, onChange, placeholder = "Rechercher dans cette rubrique…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative mb-3 max-w-xs">
      <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-[12.5px] text-foreground focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none"
      />
    </div>
  );
}

// Camembert lisible : on plafonne le nombre de parts affichées, le reste
// est agrégé dans "Autres" — même principe que dessinerPieChart côté PDF
// (backend/src/documents/documents.service.ts).
function pourCamembert(items: RepartitionLigne[], max = 8): RepartitionLigne[] {
  if (items.length <= max) return items;
  const top = items.slice(0, max - 1);
  const reste = items.slice(max - 1);
  return [...top, { libelle: "Autres", montant: reste.reduce((s, i) => s + i.montant, 0), nombre: reste.reduce((s, i) => s + i.nombre, 0), pct: reste.reduce((s, i) => s + i.pct, 0) }];
}

// Résumé visuel par rubrique (voir demande utilisateur : "pour toutes les
// rubriques... un résumé visuel. exemple : le montant moyen des
// consommations par mois") — une rangée de puces compactes, calculées côté
// client à partir des données déjà chargées (aucun aller-retour serveur).
function StatBadges({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {items.map((it) => (
        <div key={it.label} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/60 border border-border/60 px-2.5 py-1.5 text-[11.5px]">
          <span className="text-muted-foreground">{it.label} :</span>
          <span className="font-semibold text-foreground med-num">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ title, subtitle, resume, children }: { title: string; subtitle?: string; resume?: { label: string; value: string }[]; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="font-semibold text-primary text-sm border-b border-primary/25 pb-2 mb-3">{title}</h3>
      {subtitle && <p className="text-[12px] text-muted-foreground -mt-2 mb-3">{subtitle}</p>}
      {resume && <StatBadges items={resume} />}
      {children}
    </div>
  );
}

// Le modèle ne laisse jamais un tableau s'étirer sur toute la largeur de
// l'écran — il reste compact, quel que soit son nombre de colonnes (voir
// capture utilisateur : rendu "évasé, étiré"). `lignesEnEvidence` reproduit
// le fond bleu pâle + gras des lignes de sous-total (ex. "Assurés
// Principaux") du modèle.
function TableSimple({ headers, rows, lignesEnEvidence = [] }: { headers: string[]; rows: (string | number)[][]; lignesEnEvidence?: number[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 max-w-3xl">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-accent text-accent-foreground">
            {headers.map((h) => <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const enEvidence = lignesEnEvidence.includes(i);
            return (
              <tr key={i} className={`border-b border-border/50 last:border-0 ${enEvidence ? "bg-secondary/70 font-semibold" : ""}`}>
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2 whitespace-nowrap text-foreground ${j > 0 ? "text-right" : ""}`}
                    style={typeof c === "number" ? { fontFamily: "'DM Mono', monospace" } : undefined}
                  >
                    {typeof c === "number" ? fmtM(c) : c}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BarSimple<T extends object>({
  data, dataKey = "montant", labelKey = "libelle", couleurs, afficherValeurs = false, formatValeur = fmtM, barSize = 26, labelsHorizontaux = false,
}: {
  data: T[]; dataKey?: string; labelKey?: string; couleurs?: string[]; afficherValeurs?: boolean; formatValeur?: (v: number) => string; barSize?: number; labelsHorizontaux?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={barSize}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey={labelKey} tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} interval={0}
            angle={labelsHorizontaux ? 0 : -30} textAnchor={labelsHorizontaux ? "middle" : "end"} height={labelsHorizontaux ? 30 : 60}
          />
          <YAxis tick={{ fill: "#6E8BAD", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} label={{ value: "Montant consommé", angle: -90, position: "insideLeft", fill: "#6E8BAD", fontSize: 10 }} />
          <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [afficherValeurs ? formatValeur(v) : `${fmtM(v)} FCFA`]} />
          <Bar dataKey={dataKey} fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Montants">
            {couleurs && data.map((_, i) => <Cell key={i} fill={couleurs[i % couleurs.length]} />)}
            {afficherValeurs && (
              <LabelList
                dataKey={dataKey} position="center" formatter={(v: number) => formatValeur(v)}
                style={{ fill: "#fff", fontSize: 15, fontWeight: 700 }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieSimple({ data, legendeDessous = false }: { data: RepartitionLigne[]; legendeDessous?: boolean }) {
  return (
    <div className={legendeDessous ? "flex flex-col items-center gap-2 max-w-md" : "flex flex-col md:flex-row items-center gap-4 max-w-3xl"}>
      <ResponsiveContainer width="100%" height={200} className={legendeDessous ? undefined : "md:max-w-[220px]"}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={80} paddingAngle={2} dataKey="montant" nameKey="libelle">
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip {...ChartTooltipStyle} formatter={(v: number) => [`${fmtM(v)} FCFA`]} />
        </PieChart>
      </ResponsiveContainer>
      <div className={legendeDessous ? "flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5" : "space-y-1.5 flex-1 w-full"}>
        {data.map((item, i) => (
          <div key={item.libelle} className="flex items-center gap-2 text-[12px]">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-muted-foreground truncate">{item.libelle}</span>
            <span className="font-semibold text-foreground med-num flex-shrink-0">{pct(item.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface DetailLigneGenerique {
  assureNom: string;
  date: string;
  acte: string;
  montant: number;
}
interface DetailGroupeGenerique {
  id: string;
  matricule?: string;
  label: string;
  total: number;
  lignes: DetailLigneGenerique[];
}

// Descend chaque groupe (famille OU prestataire) jusqu'au niveau ligne
// (assuré, date, acte, montant) — rubriques hors modèle de référence, voir
// demandes utilisateur : "connaître précisément dans chaque famille qui a
// consommé..." puis "Détails de prestations Par prestataires". Repli sur le
// pattern lignes-repliables déjà établi (voir src/features/etat-tps/index.tsx).
function DetailGroupeTable({ groupes, labelColonne }: { groupes: DetailGroupeGenerique[]; labelColonne: string }) {
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const avecMatricule = groupes.some((g) => g.matricule);
  const toggle = (id: string) => setOuvertes((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const nbColonnes = avecMatricule ? 5 : 4;
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 max-w-3xl">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-accent text-accent-foreground">
            {["", ...(avecMatricule ? ["Matricule"] : []), labelColonne, "Nb lignes", "Montant"].map((h) => (
              <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupes.map((g) => {
            const estOuverte = ouvertes.has(g.id);
            return (
              <Fragment key={g.id}>
                <tr onClick={() => toggle(g.id)} className="border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2 text-muted-foreground">{estOuverte ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                  {avecMatricule && <td className="px-3 py-2 whitespace-nowrap text-foreground">{g.matricule}</td>}
                  <td className="px-3 py-2 whitespace-nowrap font-semibold text-foreground">{g.label}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground">{g.lignes.length}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(g.total)}</td>
                </tr>
                {estOuverte && (
                  <tr className="border-b border-border/50 bg-secondary/10">
                    <td colSpan={nbColonnes} className="px-3 py-3">
                      <table className="w-full text-[12px] rounded-lg overflow-hidden border border-border/60">
                        <thead>
                          <tr className="border-b border-border/60 bg-secondary/30">
                            {["Assuré", "Date de soin", "Acte", "Montant"].map((h) => (
                              <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.lignes.map((l, i) => (
                            <tr key={i} className="border-b border-border/40 last:border-0">
                              <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-foreground">{l.assureNom}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.date}</td>
                              <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.acte}</td>
                              <td className="px-3 py-1.5 text-right whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const zoneTexteCls = "w-full bg-transparent border border-transparent hover:border-border focus:border-primary focus:bg-background/60 rounded-lg px-2 py-1.5 -mx-2 text-[12.5px] text-foreground/90 leading-relaxed resize-y outline-none transition-colors";

function BlocAnalyseEditable({ titre, valeur, onChange, couleurTitre = "text-primary" }: { titre: string; valeur: string; onChange: (v: string) => void; couleurTitre?: string }) {
  const rows = Math.max(2, Math.min(20, valeur.split("\n").length + 1));
  return (
    <div>
      <h4 className={`text-[13px] font-semibold mb-1 ${couleurTitre}`}>{titre}</h4>
      <textarea className={zoneTexteCls} rows={rows} value={valeur} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// Forme éditable en mémoire (texte joint par bloc) — reconvertie en
// tableaux de lignes (AnalyseNarrative) au moment de l'impression. Voir
// demande utilisateur : "rendre... la zone du commentaire ou analyse
// éditable dans l'application" — les chiffres/tableaux/graphiques restent
// toujours calculés en direct, seul ce texte peut être personnalisé avant
// diffusion.
interface AnalyseEditable {
  sections: { titre: string; texte: string }[];
  conclusionGenerale: string;
  projection: string;
  conclusionStrategique: string;
  conclusionFinale: string;
}

function versEditable(a: AnalyseNarrative): AnalyseEditable {
  return {
    sections: a.sections.map((s) => ({ titre: s.titre, texte: s.lignes.join("\n") })),
    conclusionGenerale: a.conclusionGenerale.join("\n"),
    projection: a.projection.lignes.join("\n"),
    conclusionStrategique: a.conclusionStrategique.join("\n"),
    conclusionFinale: a.conclusionFinale.join("\n"),
  };
}

function versNarrative(e: AnalyseEditable, original: AnalyseNarrative): AnalyseNarrative {
  return {
    sections: e.sections.map((s) => ({ titre: s.titre, lignes: s.texte.split("\n") })),
    conclusionGenerale: e.conclusionGenerale.split("\n"),
    projection: { ...original.projection, lignes: e.projection.split("\n") },
    conclusionStrategique: e.conclusionStrategique.split("\n"),
    conclusionFinale: e.conclusionFinale.split("\n"),
  };
}

// Panneau "à la carte" (voir demande utilisateur : "l'application doit
// permettre de sélectionner [cocher] les rubriques que l'on veut voir
// apparaître sur le fichier à télécharger") — le fichier téléchargé ne
// contiendra que la page de garde + les rubriques cochées ici.
function PanneauRubriques({ selection, onChange, onClose }: { selection: Set<string>; onChange: (s: Set<string>) => void; onClose: () => void }) {
  const toggle = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  const toutCocher = () => onChange(new Set(RUBRIQUES_STATISTIQUES.map((r) => r.id)));
  const toutDecocher = () => onChange(new Set());
  return (
    <div className="absolute left-0 top-11 w-80 rounded-xl border border-border bg-card shadow-xl z-50">
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-foreground">Rubriques du fichier</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="px-3 py-2 border-b border-border/60 flex items-center gap-3 text-[11.5px]">
        <button type="button" className="text-primary hover:underline" onClick={toutCocher}>Tout cocher</button>
        <button type="button" className="text-primary hover:underline" onClick={toutDecocher}>Tout décocher</button>
      </div>
      <div className="max-h-80 overflow-y-auto py-1.5">
        {RUBRIQUES_STATISTIQUES.map((r) => (
          <label key={r.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-foreground hover:bg-secondary/40 cursor-pointer">
            <input type="checkbox" checked={selection.has(r.id)} onChange={() => toggle(r.id)} className="rounded border-border" />
            {r.label}
          </label>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border/60 text-[11px] text-muted-foreground">
        La page de garde est toujours incluse. {selection.size} rubrique(s) sélectionnée(s).
      </div>
    </div>
  );
}

export default function StatistiquesView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratId, setContratId] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [data, setData] = useState<StatistiquesPayload | null>(null);
  const [analyseEdite, setAnalyseEdite] = useState<AnalyseEditable | null>(null);
  const [generant, setGenerant] = useState(false);
  const [telechargeant, setTelechargeant] = useState<"pdf" | "docx" | null>(null);
  const [rubriquesSelectionnees, setRubriquesSelectionnees] = useState<Set<string>>(new Set(RUBRIQUES_STATISTIQUES.map((r) => r.id)));
  const [panneauOuvert, setPanneauOuvert] = useState(false);
  // Recherche ciblée par rubrique (voir demande utilisateur : "pour
  // chaque rubrique... une barre de recherche ciblée qui permettra de
  // faire la recherche uniquement dans la rubrique") — un filtre purement
  // client, chaque rubrique garde sa propre requête indépendante.
  const [recherches, setRecherches] = useState<Record<string, string>>({});
  const rq = (id: string) => recherches[id] ?? "";
  const setRq = (id: string, v: string) => setRecherches((prev) => ({ ...prev, [id]: v }));

  useEffect(() => { getContrats().then(setContrats); }, []);

  const contratSelectionne = contrats.find((c) => c.id === contratId) ?? null;

  const handleGenerer = async () => {
    if (!contratId) {
      toast.error("Sélectionnez un contrat.");
      return;
    }
    setGenerant(true);
    try {
      const resultat = await getStatistiques(contratId, du || undefined, au || undefined);
      setData(resultat);
      setAnalyseEdite(versEditable(resultat.analyse));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Génération impossible.");
    } finally {
      setGenerant(false);
    }
  };

  const analyseATelecharger = () => (data && analyseEdite ? versNarrative(analyseEdite, data.analyse) : undefined);
  const rubriquesATelecharger = () => [...rubriquesSelectionnees];

  // Génération PDF/Word (2026-09) — voir demande utilisateur : "le fichier
  // PDF ou Word ne se génère pas." openStatistiques() rejette (res.ok
  // false, ou toute erreur réseau/PDFKit/Chart.js côté serveur) sans
  // qu'aucun retour ne remonte jamais à l'écran — un clic qui échouait
  // semblait "ne rien faire", strictement indiscernable d'un clic qui
  // fonctionne mais met du temps. Corrige en entourant l'appel d'un
  // try/catch avec un toast d'erreur explicite, et un indicateur de
  // chargement pendant la génération (peut prendre plusieurs secondes sur
  // un contrat à forte volumétrie, le temps de générer tous les
  // graphiques).
  const handleTelecharger = async (format: "pdf" | "docx") => {
    if (!data) return;
    try {
      setTelechargeant(format);
      await openStatistiques(data.contrat.id, du || undefined, au || undefined, format, analyseATelecharger(), rubriquesATelecharger());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Génération du ${format === "pdf" ? "PDF" : "Word"} impossible.`);
    } finally {
      setTelechargeant(null);
    }
  };

  const beneficiairePie: RepartitionLigne[] = data
    ? data.repartitionBeneficiaire.filter((g) => g.montant > 0).map((g) => ({ libelle: g.type, montant: g.montant, nombre: g.nombre, pct: g.pctDepenses }))
    : [];

  // Résumés visuels par rubrique (voir demande utilisateur : "un résumé
  // visuel. exemple : le montant moyen des consommations par mois") —
  // dérivés côté client à partir des données déjà chargées.
  const moyenneMensuelle = data && data.evolutionMensuelle.length > 0 ? data.totalConsomme / data.evolutionMensuelle.length : 0;
  const moisPic = data?.evolutionMensuelle.reduce((max, m) => (m.montant > max.montant ? m : max), data.evolutionMensuelle[0]);
  const moyenneFamille = data && data.consommationParFamille.length > 0 ? data.totalConsomme / data.consommationParFamille.length : 0;
  const partTop20Consommateurs = data && data.totalConsomme > 0 ? (data.top20Consommateurs.reduce((s, c) => s + c.montant, 0) / data.totalConsomme) * 100 : 0;
  const coutMoyenParPersonne = data && data.totalPersonnesSoignees > 0 ? data.totalConsomme / data.totalPersonnesSoignees : 0;
  const rubriqueDominante = data?.consommationParRubrique[0];
  const familleActeDominante = data?.consommationParFamilleActe[0];
  const prestataireDominant = data?.consommationParPrestataire[0];
  const partTop20Prestataires = data && data.totalConsomme > 0 ? (data.top20Prestataires.reduce((s, p) => s + p.montant, 0) / data.totalConsomme) * 100 : 0;

  return (
    <div className="p-6 space-y-5">
      <ModuleHeader title="Statistiques" subtitle="Arrêté de situation par contrat et par période — chiffres, tableaux et graphiques calculés en direct" icon={PieChartIcon} />

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <label className="block w-72">
            <div className={labelCls}>Contrat</div>
            <Combobox
              options={contrats}
              value={contratSelectionne}
              onChange={(c) => setContratId(c?.id ?? "")}
              getLabel={(c) => `${c.numeroPolice ?? c.id} — ${c.client}`}
              getSubLabel={(c) => c.compagnie}
              getId={(c) => c.id}
              placeholder="Rechercher un contrat…"
            />
          </label>
          <label className="block">
            <div className={labelCls}>Du</div>
            <DateInput value={du} onChange={setDu} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Au</div>
            <DateInput value={au} onChange={setAu} className={fieldCls} />
          </label>
          {/* Sélection multi-année : une simple plage de dates suffit à
              couvrir plusieurs exercices (voir demande utilisateur :
              "analyse statistique sur plusieurs années") — étendre "Du" à
              une date antérieure à l'exercice en cours fait apparaître
              l'"Évolution annuelle" ci-dessous. */}
          <Btn variant="primary" onClick={handleGenerer} disabled={generant}><Search className="w-4 h-4" />{generant ? "Génération…" : "Générer"}</Btn>
          {data && (
            <>
              <div className="relative">
                <Btn variant="secondary" onClick={() => setPanneauOuvert((v) => !v)}><ListChecks className="w-4 h-4" />Rubriques ({rubriquesSelectionnees.size})</Btn>
                {panneauOuvert && <PanneauRubriques selection={rubriquesSelectionnees} onChange={setRubriquesSelectionnees} onClose={() => setPanneauOuvert(false)} />}
              </div>
              <Btn variant="ghost" disabled={telechargeant !== null} onClick={() => handleTelecharger("pdf")}><FileDown className="w-4 h-4" />{telechargeant === "pdf" ? "Génération…" : "Télécharger PDF"}</Btn>
              <Btn variant="ghost" disabled={telechargeant !== null} onClick={() => handleTelecharger("docx")}><FileText className="w-4 h-4" />{telechargeant === "docx" ? "Génération…" : "Télécharger Word"}</Btn>
            </>
          )}
        </div>
      </div>

      {!data && (
        <div className="bg-card border border-border rounded-xl py-16 text-center text-muted-foreground text-sm">
          Sélectionnez un contrat et cliquez sur « Générer » pour afficher les statistiques.
        </div>
      )}

      {data && analyseEdite && (
        <>
          <SectionCard title="Bases Contractuelles">
            <TableSimple
              headers={["Collège", "Assureur", "Police n°", "Date d'effet"]}
              rows={[[data.basesContractuelles.college, data.basesContractuelles.assureur, data.basesContractuelles.policeNumero, data.basesContractuelles.dateEffet]]}
            />
          </SectionCard>

          <SectionCard
            title="Évolution des consommations par mois"
            resume={[
              { label: "Moyenne mensuelle", value: `${fmtM(moyenneMensuelle)} FCFA` },
              ...(moisPic ? [{ label: "Mois le plus consommateur", value: `${moisPic.label} (${fmtM(moisPic.montant)} FCFA)` }] : []),
            ]}
          >
            <div className="space-y-3">
              <RechercheRubrique value={rq("evolutionMensuelle")} onChange={(v) => setRq("evolutionMensuelle", v)} placeholder="Rechercher un mois…" />
              <TableSimple
                headers={["Mois", "Montant consommé"]}
                rows={[...data.evolutionMensuelle.filter((m) => correspond(rq("evolutionMensuelle"), m.label)).map((m) => [m.label, m.montant]), ["Total", data.totalConsomme]]}
                lignesEnEvidence={[data.evolutionMensuelle.filter((m) => correspond(rq("evolutionMensuelle"), m.label)).length]}
              />
              <BarSimple data={data.evolutionMensuelle.filter((m) => correspond(rq("evolutionMensuelle"), m.label))} labelKey="label" />
              {data.evolutionAnnuelle.length > 1 && (
                <div>
                  <div className="text-[12px] font-semibold text-foreground mb-2">Évolution annuelle</div>
                  <TableSimple headers={["Année", "Montant consommé"]} rows={data.evolutionAnnuelle.map((a) => [a.label, a.montant])} />
                  <div className="mt-3">
                    <BarSimple data={data.evolutionAnnuelle} labelKey="label" labelsHorizontaux barSize={80} />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Consommation par famille"
            subtitle={`${data.consommationParFamille.length} famille(s)`}
            resume={[{ label: "Moyenne par famille", value: `${fmtM(moyenneFamille)} FCFA` }]}
          >
            <RechercheRubrique value={rq("consommationParFamille")} onChange={(v) => setRq("consommationParFamille", v)} placeholder="Rechercher une famille, un matricule…" />
            <TableSimple
              headers={["Matricule", "Famille", "Montant consommé"]}
              rows={[...data.consommationParFamille.filter((f) => correspond(rq("consommationParFamille"), f.matricule, f.famille)).map((f) => [f.matricule, f.famille, f.montant]), ["", "Total", data.totalConsomme]]}
              lignesEnEvidence={[data.consommationParFamille.filter((f) => correspond(rq("consommationParFamille"), f.matricule, f.famille)).length]}
            />
          </SectionCard>

          <SectionCard title="Détails de Consommation Par Famille" subtitle="Cliquez une famille pour voir qui a consommé, pour quel acte et à quelle date.">
            <RechercheRubrique value={rq("detailParFamille")} onChange={(v) => setRq("detailParFamille", v)} placeholder="Rechercher une famille, un matricule, un assuré, un acte…" />
            <DetailGroupeTable
              labelColonne="Famille"
              groupes={data.detailParFamille
                .filter((f) => correspond(rq("detailParFamille"), f.matricule, f.famille, ...f.lignes.flatMap((l) => [l.assureNom, l.acte])))
                .map((f) => ({ id: f.matricule, matricule: f.matricule, label: f.famille, total: f.totalFamille, lignes: f.lignes }))}
            />
          </SectionCard>

          <SectionCard title="Top 20 des consommateurs" resume={[{ label: "Part du Top 20 dans le total", value: pct(partTop20Consommateurs) }]}>
            <div className="space-y-3">
              <RechercheRubrique value={rq("top20Consommateurs")} onChange={(v) => setRq("top20Consommateurs", v)} placeholder="Rechercher une famille, un matricule…" />
              <TableSimple headers={["Matricule", "Famille", "Montant consommé"]} rows={data.top20Consommateurs.filter((f) => correspond(rq("top20Consommateurs"), f.matricule, f.famille)).map((f) => [f.matricule, f.famille, f.montant])} />
              <BarSimple data={data.top20Consommateurs.filter((f) => correspond(rq("top20Consommateurs"), f.matricule, f.famille)).map((f) => ({ libelle: f.famille.replace(/^Famille /, ""), montant: f.montant }))} />
            </div>
          </SectionCard>

          <SectionCard title="Répartition par type de bénéficiaire" resume={[{ label: "Coût moyen par personne soignée", value: `${fmtM(coutMoyenParPersonne)} FCFA` }]}>
            <div className="space-y-3">
              <TableSimple
                headers={["Type de Bénéficiaire", "Nombre Personnes soignées", "Montant Remboursé", "% Dépenses", "% Population Soignée"]}
                rows={[
                  ...data.repartitionBeneficiaire.flatMap((g) => [
                    [g.type, g.nombre, g.montant, pct(g.pctDepenses), pct(g.pctPopulation)],
                    ["Féminin", g.feminin.nombre, g.feminin.montant, pct(g.feminin.pctDepenses), pct(g.feminin.pctPopulation)],
                    ["Masculin", g.masculin.nombre, g.masculin.montant, pct(g.masculin.pctDepenses), pct(g.masculin.pctPopulation)],
                  ]),
                  ["Total", data.totalPersonnesSoignees, data.totalConsomme, "100%", "100%"],
                ]}
                lignesEnEvidence={[0, 3, 6, 9]}
              />
              {beneficiairePie.length > 0 && <PieSimple data={beneficiairePie} legendeDessous />}
            </div>
          </SectionCard>

          <SectionCard
            title="Consommation par Rubrique"
            resume={rubriqueDominante ? [{ label: "Rubrique dominante", value: `${rubriqueDominante.libelle} (${pct(rubriqueDominante.pct)})` }] : undefined}
          >
            <div className="space-y-3">
              <RechercheRubrique value={rq("consommationParRubrique")} onChange={(v) => setRq("consommationParRubrique", v)} placeholder="Rechercher une rubrique…" />
              <TableSimple
                headers={["Rubrique", "Remboursé", "Nombre Actes", "En % sur total remboursé"]}
                rows={[...data.consommationParRubrique.filter((r) => correspond(rq("consommationParRubrique"), r.libelle)).map((r) => [r.libelle, r.montant, r.nombre, pct(r.pct)]), ["Total", data.totalConsomme, data.consommationParRubrique.reduce((s, r) => s + r.nombre, 0), "100%"]]}
                lignesEnEvidence={[data.consommationParRubrique.filter((r) => correspond(rq("consommationParRubrique"), r.libelle)).length]}
              />
              {data.consommationParRubrique.length > 0 && <PieSimple data={pourCamembert(data.consommationParRubrique.filter((r) => correspond(rq("consommationParRubrique"), r.libelle)))} />}
            </div>
          </SectionCard>

          <SectionCard
            title="Consommation par Famille d'Actes"
            resume={familleActeDominante ? [{ label: "Famille dominante", value: `${familleActeDominante.libelle} (${pct(familleActeDominante.pct)})` }] : undefined}
          >
            <div className="space-y-3">
              <RechercheRubrique value={rq("consommationParFamilleActe")} onChange={(v) => setRq("consommationParFamilleActe", v)} placeholder="Rechercher une famille d'actes…" />
              <TableSimple
                headers={["Famille d'actes", "Remboursé", "Nombre Actes", "En % sur total remboursé"]}
                rows={[...data.consommationParFamilleActe.filter((r) => correspond(rq("consommationParFamilleActe"), r.libelle)).map((r) => [r.libelle, r.montant, r.nombre, pct(r.pct)]), ["Total", data.totalConsomme, data.consommationParFamilleActe.reduce((s, r) => s + r.nombre, 0), "100%"]]}
                lignesEnEvidence={[data.consommationParFamilleActe.filter((r) => correspond(rq("consommationParFamilleActe"), r.libelle)).length]}
              />
              {data.consommationParFamilleActe.length > 0 && <PieSimple data={pourCamembert(data.consommationParFamilleActe.filter((r) => correspond(rq("consommationParFamilleActe"), r.libelle)))} />}
            </div>
          </SectionCard>

          <SectionCard
            title="Consommation par Prestataire"
            resume={[
              { label: "Nombre de prestataires", value: String(data.consommationParPrestataire.length) },
              ...(prestataireDominant ? [{ label: "Prestataire dominant", value: `${prestataireDominant.libelle} (${pct(prestataireDominant.pct)})` }] : []),
            ]}
          >
            <div className="space-y-3">
              <RechercheRubrique value={rq("consommationParPrestataire")} onChange={(v) => setRq("consommationParPrestataire", v)} placeholder="Rechercher un prestataire…" />
              <TableSimple
                headers={["Prestataire", "Montant Total Réglé", "% Sur Total"]}
                rows={[...data.consommationParPrestataire.filter((p) => correspond(rq("consommationParPrestataire"), p.libelle)).map((p) => [p.libelle, p.montant, pct(p.pct)]), ["Total", data.totalConsomme, "100%"]]}
                lignesEnEvidence={[data.consommationParPrestataire.filter((p) => correspond(rq("consommationParPrestataire"), p.libelle)).length]}
              />
              {data.consommationParPrestataire.length > 0 && <PieSimple data={pourCamembert(data.consommationParPrestataire.filter((p) => correspond(rq("consommationParPrestataire"), p.libelle)))} />}
            </div>
          </SectionCard>

          <SectionCard title="Détails de Prestations Par Prestataires" subtitle="Cliquez un prestataire pour voir qui s'y est fait soigner, pour quel acte et à quelle date.">
            <RechercheRubrique value={rq("detailParPrestataire")} onChange={(v) => setRq("detailParPrestataire", v)} placeholder="Rechercher un prestataire, un assuré, un acte…" />
            <DetailGroupeTable
              labelColonne="Prestataire"
              groupes={data.detailParPrestataire
                .filter((p) => correspond(rq("detailParPrestataire"), p.prestataire, ...p.lignes.flatMap((l) => [l.assureNom, l.acte])))
                .map((p) => ({ id: p.prestataire, label: p.prestataire, total: p.totalPrestataire, lignes: p.lignes }))}
            />
          </SectionCard>

          <SectionCard title="Top 20 des prestataires" resume={[{ label: "Part du Top 20 dans le total", value: pct(partTop20Prestataires) }]}>
            <div>
              <RechercheRubrique value={rq("top20Prestataires")} onChange={(v) => setRq("top20Prestataires", v)} placeholder="Rechercher un prestataire…" />
              <BarSimple data={data.top20Prestataires.filter((p) => correspond(rq("top20Prestataires"), p.libelle))} />
            </div>
          </SectionCard>

          <SectionCard title="Evolution du S/P">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-primary mb-1.5">Sans Chargement</div>
                  <TableSimple headers={["Souscripteur", "Police", "Garanties", "Sinistres", "Primes", "S/P"]} rows={[[data.contrat.client, data.contrat.numeroPolice, data.contrat.garantiesPrivees, data.spSansChargement.sinistres, data.spSansChargement.primes, fmtRatio(data.spSansChargement.ratioPct)]]} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-accent mb-1.5">Avec Chargement</div>
                  <TableSimple headers={["Souscripteur", "Police", "Garanties", "Sinistres", "Primes", "S/P"]} rows={[[data.contrat.client, data.contrat.numeroPolice, data.contrat.garantiesPrivees, data.spAvecChargement.sinistres, data.spAvecChargement.primes, fmtRatio(data.spAvecChargement.ratioPct)]]} />
                </div>
              </div>
              <BarSimple
                data={[{ libelle: "S/P sans chargement", montant: data.spSansChargement.ratioPct }, { libelle: "S/P avec chargement", montant: data.spAvecChargement.ratioPct }]}
                couleurs={["var(--primary)", "var(--accent)"]}
                afficherValeurs
                formatValeur={fmtRatio}
                barSize={140}
                labelsHorizontaux
              />
            </div>
          </SectionCard>

          <SectionCard title="Analyse des données statistiques" subtitle="Généré automatiquement à partir des chiffres ci-dessus (moteur de règles) — le texte ci-dessous est librement modifiable avant impression/téléchargement.">
            <div className="space-y-5">
              {analyseEdite.sections.map((s, i) => (
                <BlocAnalyseEditable
                  key={s.titre}
                  titre={s.titre}
                  valeur={s.texte}
                  onChange={(v) => setAnalyseEdite((prev) => prev && { ...prev, sections: prev.sections.map((x, j) => (j === i ? { ...x, texte: v } : x)) })}
                />
              ))}
              <BlocAnalyseEditable titre="Conclusion générale" valeur={analyseEdite.conclusionGenerale} onChange={(v) => setAnalyseEdite((prev) => prev && { ...prev, conclusionGenerale: v })} />
              <BlocAnalyseEditable titre="Analyse de l'évolution et projection" valeur={analyseEdite.projection} onChange={(v) => setAnalyseEdite((prev) => prev && { ...prev, projection: v })} />
              <BlocAnalyseEditable titre="Conclusion stratégique" valeur={analyseEdite.conclusionStrategique} couleurTitre="text-destructive" onChange={(v) => setAnalyseEdite((prev) => prev && { ...prev, conclusionStrategique: v })} />
              <BlocAnalyseEditable titre="Conclusion finale" valeur={analyseEdite.conclusionFinale} onChange={(v) => setAnalyseEdite((prev) => prev && { ...prev, conclusionFinale: v })} />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
