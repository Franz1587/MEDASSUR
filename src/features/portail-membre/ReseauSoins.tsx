import "leaflet/dist/leaflet.css";
import "@/lib/leafletIconFix";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin, Phone, Stethoscope, Search, X, ArrowLeft, FileDown, ChevronRight } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { getReseauSoins, getPrestataireReseau, type PrestataireReseau, type PrestataireReseauDetail } from "@/services/reseauSoins.service";
import { openReseauSoins } from "@/services/documents.service";
import { toast } from "sonner";

function secteurVariant(secteur?: string | null): BadgeVariant {
  return secteur === "Public" ? "info" : secteur === "Privé" ? "gold" : "neutral";
}

// Icône + couleur par catégorie
const CAT_CONFIG: Record<string, { emoji: string; bg: string; ring: string }> = {
  "Hôpital":                 { emoji: "🏥", bg: "bg-red-50 dark:bg-red-950/30",     ring: "border-red-200 dark:border-red-800" },
  "Clinique":                { emoji: "🏨", bg: "bg-blue-50 dark:bg-blue-950/30",    ring: "border-blue-200 dark:border-blue-800" },
  "Cabinet":                 { emoji: "🩺", bg: "bg-sky-50 dark:bg-sky-950/30",      ring: "border-sky-200 dark:border-sky-800" },
  "Cabinet Dentaire":        { emoji: "🦷", bg: "bg-indigo-50 dark:bg-indigo-950/30",ring: "border-indigo-200 dark:border-indigo-800" },
  "Pharmacie":               { emoji: "💊", bg: "bg-green-50 dark:bg-green-950/30",  ring: "border-green-200 dark:border-green-800" },
  "Dépôt pharmaceutique":    { emoji: "📦", bg: "bg-teal-50 dark:bg-teal-950/30",    ring: "border-teal-200 dark:border-teal-800" },
  "Laboratoire":             { emoji: "🔬", bg: "bg-violet-50 dark:bg-violet-950/30",ring: "border-violet-200 dark:border-violet-800" },
  "Centre d'Imagerie":       { emoji: "🖥",  bg: "bg-purple-50 dark:bg-purple-950/30",ring: "border-purple-200 dark:border-purple-800" },
  "Centre de Kinésithérapie":{ emoji: "🏋",  bg: "bg-orange-50 dark:bg-orange-950/30",ring: "border-orange-200 dark:border-orange-800" },
  "Opticien":                { emoji: "👁",  bg: "bg-amber-50 dark:bg-amber-950/30", ring: "border-amber-200 dark:border-amber-800" },
};
const CAT_DEFAULT = { emoji: "🏥", bg: "bg-secondary/40", ring: "border-border" };

export default function MembreReseauSoinsView() {
  const [tous, setTous] = useState<PrestataireReseau[] | null>(null);
  const [categorie, setCategorie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrestataireReseauDetail | null>(null);

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
    return (tous ?? []).filter((p) => {
      if (categorie && p.type !== categorie) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""} ${p.ville} ${p.province ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      const provCmp = (a.province ?? "").localeCompare(b.province ?? "", "fr");
      if (provCmp !== 0) return provCmp;
      const villeCmp = a.ville.localeCompare(b.ville, "fr");
      if (villeCmp !== 0) return villeCmp;
      return a.nom.localeCompare(b.nom, "fr");
    });
  }, [tous, categorie, recherche]);

  const total = tous?.length ?? 0;

  const handleDownload = () => openReseauSoins().catch(() => toast.error("Ouverture du document impossible."));

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
                    <span className="text-2xl leading-none">{cfg.emoji}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-foreground">{type}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{n} prestataire{n !== 1 ? "s" : ""}</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground self-end" />
                  </button>
                );
              })}
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

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un nom, une ville, une province…"
              className="w-full h-10 pl-9 pr-8 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground"
            />
            {recherche && (
              <button type="button" onClick={() => setRecherche("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>

          {filtres.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun prestataire ne correspond à ces critères.</div>
          ) : (
            <div className="space-y-1.5">
              {filtres.map((p, i) => {
                const showProvince = i === 0 || filtres[i - 1].province !== p.province;
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
                        <span className="text-xl leading-none flex-shrink-0">{(CAT_CONFIG[p.type] ?? CAT_DEFAULT).emoji}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-foreground truncate">{p.titre ? `${p.titre} ` : ""}{p.nom}</span>
                          <span className="block text-[11.5px] text-muted-foreground truncate">
                            {p.specialite ? `${p.specialite.split("·")[0].trim()} · ` : ""}{p.ville}
                          </span>
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 flex-shrink-0">
                        {p.secteur && <Badge variant={secteurVariant(p.secteur)}>{p.secteur}</Badge>}
                        {p.latitude != null && <MapPin className="w-3.5 h-3.5 text-emerald-500" />}
                      </span>
                    </button>
                  </div>
                );
              })}
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
                    <span className="text-2xl leading-none flex-shrink-0">{(CAT_CONFIG[detail.type] ?? CAT_DEFAULT).emoji}</span>
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
