import "leaflet/dist/leaflet.css";
import "@/lib/leafletIconFix";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin, Phone, Stethoscope, Search, X, ArrowLeft, FileDown, ChevronRight, Hospital, Building2, Pill, Package, FlaskConical, ScanLine, Dumbbell, Eye, Smile, LocateFixed, Loader2, type LucideIcon } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Pager } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getReseauSoins, getMedecinsReseau, getPrestataireReseau, type PrestataireReseau, type PrestataireReseauDetail, type MedecinReseau } from "@/services/reseauSoins.service";
import { openReseauSoins } from "@/services/documents.service";
import { toast } from "sonner";

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function secteurVariant(secteur?: string | null): BadgeVariant {
  return secteur === "Public" ? "info" : secteur === "Privé" ? "gold" : "neutral";
}

// Icône + couleur par catégorie
const CAT_CONFIG: Record<string, { Icon: LucideIcon; color: string; bg: string; ring: string }> = {
  "Hôpital":                 { Icon: Hospital,      color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950/30",      ring: "border-red-200 dark:border-red-800" },
  "Clinique":                { Icon: Building2,     color: "text-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/30",    ring: "border-blue-200 dark:border-blue-800" },
  "Cabinet":                 { Icon: Stethoscope,   color: "text-sky-500",    bg: "bg-sky-50 dark:bg-sky-950/30",      ring: "border-sky-200 dark:border-sky-800" },
  "Cabinet Dentaire":        { Icon: Smile,         color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950/30",ring: "border-indigo-200 dark:border-indigo-800" },
  "Pharmacie":               { Icon: Pill,          color: "text-green-500",  bg: "bg-green-50 dark:bg-green-950/30",  ring: "border-green-200 dark:border-green-800" },
  "Dépôt pharmaceutique":    { Icon: Package,       color: "text-teal-500",   bg: "bg-teal-50 dark:bg-teal-950/30",    ring: "border-teal-200 dark:border-teal-800" },
  "Laboratoire":             { Icon: FlaskConical,  color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30",ring: "border-violet-200 dark:border-violet-800" },
  "Centre d'Imagerie":       { Icon: ScanLine,      color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30",ring: "border-purple-200 dark:border-purple-800" },
  "Centre de Kinésithérapie":{ Icon: Dumbbell,      color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950/30",ring: "border-orange-200 dark:border-orange-800" },
  "Opticien":                { Icon: Eye,           color: "text-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/30",  ring: "border-amber-200 dark:border-amber-800" },
};
const CAT_DEFAULT = { Icon: Hospital, color: "text-muted-foreground", bg: "bg-secondary/40", ring: "border-border" };

function VueMedecins({ onRetour }: { onRetour: () => void }) {
  const [medecins, setMedecins] = useState<MedecinReseau[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [specialite, setSpecialite] = useState<string | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);

  useEffect(() => { getMedecinsReseau().then(setMedecins).catch(() => toast.error("Chargement des médecins impossible.")); }, []);

  const specialites = useMemo(() => {
    const s = new Set<string>();
    for (const m of medecins ?? []) if (m.specialite) s.add(m.specialite);
    return [...s].sort((a, b) => a.localeCompare(b, "fr"));
  }, [medecins]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (medecins ?? []).filter((m) => {
      if (specialite && m.specialite !== specialite) return false;
      if (q && !`${m.titre ?? ""} ${m.nom} ${m.prenom ?? ""} ${m.specialite ?? ""} ${m.prestataires.map((p) => p.nom).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [medecins, recherche, specialite]);

  const pag = usePagination(filtres, 25);
  const selection = useMemo(() => selectionId ? (medecins ?? []).find((m) => m.id === selectionId) : null, [selectionId, medecins]);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onRetour} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <span className="text-[14px] font-semibold text-foreground">Médecins</span>
          {medecins && <span className="ml-2 text-[12px] text-muted-foreground">({filtres.length} sur {medecins.length})</span>}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={recherche}
            onChange={(e) => { setRecherche(e.target.value); pag.setPage(1); }}
            placeholder="Nom, prénom, spécialité, établissement…"
            className="w-full h-10 pl-9 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground"
          />
          {recherche && <button type="button" onClick={() => setRecherche("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {specialites.length > 0 && (
          <select
            value={specialite ?? ""}
            onChange={(e) => { setSpecialite(e.target.value || null); pag.setPage(1); }}
            className="h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground sm:w-56"
          >
            <option value="">Toutes les spécialités</option>
            {specialites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {medecins === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : filtres.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun médecin ne correspond à ces critères.</div>
      ) : (
        <div className="space-y-1.5">
          {pag.pageItems.map((m) => {
            const prevM = pag.pageItems[pag.pageItems.indexOf(m) - 1];
            const showSpec = m.specialite && (!prevM || prevM.specialite !== m.specialite);
            return (
              <div key={m.id}>
                {showSpec && (
                  <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground pt-3 pb-1.5 px-1">{m.specialite}</p>
                )}
                <button
                  type="button"
                  onClick={() => setSelectionId(m.id)}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-card border border-border rounded-xl text-left hover:border-primary/40 transition-colors"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Stethoscope className="w-5 h-5 flex-shrink-0 text-sky-500" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground">{m.titre ? `${m.titre} ` : ""}{m.nom}{m.prenom ? ` ${m.prenom}` : ""}</span>
                      <span className="block text-[11.5px] text-muted-foreground truncate">{m.specialite ?? "Généraliste"}{m.prestataires.length > 0 ? ` · ${m.prestataires[0].ville}` : ""}</span>
                    </span>
                  </span>
                  {m.prestataires.length > 0 && (
                    <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block">{m.prestataires[0].nom}</span>
                  )}
                </button>
              </div>
            );
          })}
          <Pager p={pag} />
        </div>
      )}

      {selection && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSelectionId(null)}>
          <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Stethoscope className="w-6 h-6 flex-shrink-0 text-sky-500" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-foreground">{selection.titre ? `${selection.titre} ` : ""}{selection.nom}{selection.prenom ? ` ${selection.prenom}` : ""}</h3>
                  <p className="text-[11px] text-muted-foreground">{selection.specialite ?? "Médecin généraliste"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectionId(null)} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="p-4 space-y-3.5">
              {selection.telephone && (
                <div className="flex items-center gap-2 text-[13px] p-3 rounded-xl bg-secondary/20 border border-border">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-foreground">{selection.telephone}</span>
                </div>
              )}
              {selection.prestataires.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />Établissements ({selection.prestataires.length})
                  </p>
                  <div className="space-y-1.5">
                    {selection.prestataires.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/25 border border-border/40">
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-foreground truncate">{p.nom}</p>
                          <p className="text-[11px] text-muted-foreground">{p.type} · {p.ville}{p.province ? `, ${p.province}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selection.prestataires.length === 0 && !selection.telephone && (
                <p className="text-[12.5px] text-muted-foreground italic text-center py-4">Aucune information complémentaire disponible.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MembreReseauSoinsView() {
  const [tous, setTous] = useState<PrestataireReseau[] | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [vueMedecins, setVueMedecins] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrestataireReseauDetail | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => { getReseauSoins().then(setTous); }, []);

  useEffect(() => {
    if (!selectionId) { setDetail(null); return; }
    setDetail(null);
    getPrestataireReseau(selectionId).then(setDetail);
  }, [selectionId]);

  const categories = useMemo(() => {
    const compteurs = new Map<string, number>();
    for (const p of tous ?? []) compteurs.set(p.type, (compteurs.get(p.type) ?? 0) + 1);
    return [...compteurs.entries()].sort((a, b) => b[1] - a[1]);
  }, [tous]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const liste = (tous ?? []).filter((p) => {
      if (categorie && p.type !== categorie) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""} ${p.ville} ${p.province ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (gpsCoords) {
      return liste
        .map((p) => ({
          p,
          dist: p.latitude != null && p.longitude != null
            ? haversineKm(gpsCoords.lat, gpsCoords.lng, p.latitude, p.longitude)
            : Infinity,
        }))
        .sort((a, b) => a.dist - b.dist)
        .map(({ p, dist }) => ({ ...p, _dist: dist === Infinity ? null : dist }));
    }
    return liste
      .sort((a, b) => {
        const provCmp = (a.province ?? "").localeCompare(b.province ?? "", "fr");
        if (provCmp !== 0) return provCmp;
        const villeCmp = (a.ville ?? "").localeCompare(b.ville ?? "", "fr");
        if (villeCmp !== 0) return villeCmp;
        return a.nom.localeCompare(b.nom, "fr");
      })
      .map((p) => ({ ...p, _dist: null as number | null }));
  }, [tous, categorie, recherche, gpsCoords]);

  const total = tous?.length ?? 0;

  const pagFiltres = usePagination(filtres, 20);

  const localiserMoi = () => {
    if (!navigator.geolocation) { toast.error("Géolocalisation non disponible sur cet appareil."); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsLoading(false); },
      () => { toast.error("Impossible d'obtenir votre position. Vérifiez les autorisations."); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleDownload = () => openReseauSoins().catch(() => toast.error("Ouverture du document impossible."));

  if (vueMedecins) return <VueMedecins onRetour={() => setVueMedecins(false)} />;

  return (
    <div className="p-5 space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[1.15rem] font-bold text-foreground">Réseau de soins</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {total > 0 ? `${total} prestataires conventionnés · Gabon` : "Trouvez un prestataire conventionné près de vous"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-[11.5px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors flex-shrink-0"
        >
          <FileDown className="w-3.5 h-3.5" />
          PDF
        </button>
      </div>

      {!categorie ? (
        /* ── Écran catégories ── */
        <>
          {tous === null ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {categories.map(([type, n]) => {
                const cfg = CAT_CONFIG[type] ?? CAT_DEFAULT;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCategorie(type)}
                    className={`${cfg.bg} border ${cfg.ring} rounded-2xl p-4 flex flex-col items-start gap-2.5 hover:shadow-sm transition-all text-left`}
                  >
                    <cfg.Icon className={`w-6 h-6 ${cfg.color}`} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">{type}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{n} prestataire{n !== 1 ? "s" : ""}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground self-end" />
                  </button>
                );
              })}
              {/* Tile répertoire médecins — toujours visible, données indépendantes des prestataires */}
              <button
                type="button"
                onClick={() => setVueMedecins(true)}
                className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl p-4 flex flex-col items-start gap-2.5 hover:shadow-sm transition-all text-left"
              >
                <Stethoscope className="w-6 h-6 text-sky-500" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-foreground">Médecins</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">Répertoire des médecins</span>
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground self-end" />
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Écran liste ── */
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setCategorie(null); setRecherche(""); }}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-[14px] font-semibold text-foreground">{categorie}</span>
            <span className="text-[12px] text-muted-foreground">({filtres.length})</span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={recherche}
                onChange={(e) => { setRecherche(e.target.value); pagFiltres.setPage(1); }}
                placeholder="Rechercher un nom, une ville, une province…"
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground"
              />
              {recherche && (
                <button type="button" onClick={() => setRecherche("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <button
              type="button"
              onClick={gpsCoords ? () => setGpsCoords(null) : localiserMoi}
              disabled={gpsLoading}
              title={gpsCoords ? "Désactiver le tri par proximité" : "Trier par proximité GPS"}
              className={`h-10 px-3 rounded-lg border text-[11.5px] flex items-center gap-1.5 flex-shrink-0 transition-colors ${gpsCoords ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
            >
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              <span className="hidden sm:inline">{gpsCoords ? "Près de moi ✓" : "Près de moi"}</span>
            </button>
          </div>

          {gpsCoords && (
            <p className="text-[11.5px] text-primary flex items-center gap-1.5">
              <LocateFixed className="w-3.5 h-3.5" />
              Tri par proximité activé — les prestataires les plus proches apparaissent en premier.
            </p>
          )}

          {filtres.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun prestataire ne correspond à ces critères.</div>
          ) : (
            <div className="space-y-1.5">
              {pagFiltres.pageItems.map((p, i) => {
                const prevP = pagFiltres.pageItems[i - 1];
                const showProvince = !gpsCoords && (i === 0 || prevP?.province !== p.province);
                return (
                  <div key={p.id}>
                    {showProvince && p.province && (
                      <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground pt-3 pb-1.5 px-1">{p.province}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectionId(p.id)}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-card border border-border rounded-xl text-left hover:border-primary/40 transition-colors"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {(() => { const c = CAT_CONFIG[p.type] ?? CAT_DEFAULT; return <c.Icon className={`w-5 h-5 flex-shrink-0 ${c.color}`} />; })()}
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-foreground truncate">{p.titre ? `${p.titre} ` : ""}{p.nom}</span>
                          <span className="block text-[11.5px] text-muted-foreground truncate">
                            {p.specialite ? `${p.specialite.split("·")[0].trim()} · ` : ""}{p.ville}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        {gpsCoords && p._dist != null && (
                          <span className="text-[11px] font-medium text-primary">{fmtDist(p._dist)}</span>
                        )}
                        {p.secteur && <Badge variant={secteurVariant(p.secteur)}>{p.secteur}</Badge>}
                        {p.latitude != null && <MapPin className="w-3.5 h-3.5 text-emerald-500" />}
                      </span>
                    </button>
                  </div>
                );
              })}
              <Pager p={pagFiltres} />
            </div>
          )}
        </>
      )}

      {/* Modal détail */}
      {selectionId && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSelectionId(null)}>
          <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
            ) : (
              <>
                <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {(() => { const c = CAT_CONFIG[detail.type] ?? CAT_DEFAULT; return <c.Icon className={`w-6 h-6 flex-shrink-0 ${c.color}`} />; })()}
                    <div className="min-w-0">
                      <h3 className="text-[14px] font-semibold text-foreground truncate">{detail.titre ? `${detail.titre} ` : ""}{detail.nom}</h3>
                      <p className="text-[11px] text-muted-foreground">{detail.type}{detail.specialite ? ` · ${detail.specialite}` : ""}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectionId(null)} className="h-8 w-8 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                </div>

                <div className="p-4 space-y-3.5">
                  <div className="space-y-2.5 text-[13px] p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className="text-foreground">{detail.adresse ? `${detail.adresse}, ` : ""}{detail.ville}{detail.province ? `, ${detail.province}` : ""}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className={detail.telephone ? "text-foreground" : "text-muted-foreground italic text-[12px]"}>{detail.telephone ?? "Non renseigné"}</p>
                    </div>
                  </div>

                  {detail.latitude != null && detail.longitude != null ? (
                    <div className="h-52 rounded-xl overflow-hidden border border-border">
                      <MapContainer center={[detail.latitude, detail.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[detail.latitude, detail.longitude]}>
                          <Popup>{detail.nom}<br />{detail.adresse}</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="h-24 rounded-xl border border-dashed border-border flex items-center justify-center text-[12px] text-muted-foreground">
                      Coordonnées non disponibles.
                    </div>
                  )}

                  {detail.type !== "Médecin" && detail.medecins.length > 0 && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Médecins ({detail.medecins.length})</p>
                      <div className="space-y-1.5">
                        {detail.medecins.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/25">
                            <span className="text-[12.5px] text-foreground">{m.titre ? `${m.titre} ` : ""}{m.nom}</span>
                            <span className="text-[11.5px] text-muted-foreground">{m.specialite ?? "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
