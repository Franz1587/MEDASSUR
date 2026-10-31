import "leaflet/dist/leaflet.css";
import "@/lib/leafletIconFix";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import {
  MapPin, Phone, Building2, Stethoscope, Search, X, ChevronDown, ChevronRight,
  FileDown, Shield, MapPinned, LayoutGrid,
} from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { getReseauSoins, getPrestataireReseau, type PrestataireReseau, type PrestataireReseauDetail } from "@/services/reseauSoins.service";
import { openReseauSoins } from "@/services/documents.service";
import { toast } from "sonner";

const ORDRE_PROVINCES = [
  "Estuaire","Ogooué-Maritime","Haut-Ogooué","Ngounié",
  "Woleu-Ntem","Nyanga","Ogooué-Lolo","Moyen-Ogooué","Ogooué-Ivindo",
];

const TYPE_ICONES: Record<string, string> = {
  "Hôpital": "🏥", "Clinique": "🏨", "Cabinet": "🩺",
  "Cabinet Dentaire": "🦷", "Pharmacie": "💊", "Dépôt pharmaceutique": "📦",
  "Laboratoire": "🔬", "Centre d'Imagerie": "🖥", "Centre de Kinésithérapie": "🏋",
  "Opticien": "👁",
};

function secteurVariant(secteur?: string | null): BadgeVariant {
  return secteur === "Public" ? "info" : secteur === "Privé" ? "gold" : "neutral";
}

function provinceLabel(p: string): string {
  const abbr: Record<string, string> = {
    "Estuaire": "EST", "Ogooué-Maritime": "OGM", "Haut-Ogooué": "HO",
    "Ngounié": "NGO", "Woleu-Ntem": "WN", "Nyanga": "NYA",
    "Ogooué-Lolo": "OGL", "Moyen-Ogooué": "MO", "Ogooué-Ivindo": "OGI",
  };
  return abbr[p] ?? p.slice(0, 3).toUpperCase();
}

export default function PortailReseauSoinsView() {
  const [tous, setTous] = useState<PrestataireReseau[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [typeChoisi, setTypeChoisi] = useState<string | null>(null);
  const [provinceOuverte, setProvinceOuverte] = useState<string | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrestataireReseauDetail | null>(null);

  useEffect(() => {
    getReseauSoins().then((liste) => {
      setTous(liste);
      // Ouvrir la première province par défaut
      const premiereProvince = ORDRE_PROVINCES.find((p) => liste.some((x) => (x.province || "Autres") === p));
      setProvinceOuverte(premiereProvince ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selectionId) { setDetail(null); return; }
    setDetail(null);
    getPrestataireReseau(selectionId).then(setDetail);
  }, [selectionId]);

  const types = useMemo(() => [...new Set((tous ?? []).map((p) => p.type))].sort(), [tous]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (tous ?? []).filter((p) => {
      if (typeChoisi && p.type !== typeChoisi) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""} ${p.ville}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tous, typeChoisi, recherche]);

  // Groupement province → ville → prestataires
  const parProvince = useMemo(() => {
    const map = new Map<string, Map<string, PrestataireReseau[]>>();
    for (const p of filtres) {
      const prov = p.province || "Autres";
      const gProv = map.get(prov) ?? new Map<string, PrestataireReseau[]>();
      const gVille = gProv.get(p.ville) ?? [];
      gVille.push(p);
      gProv.set(p.ville, gVille);
      map.set(prov, gProv);
    }
    return map;
  }, [filtres]);

  const provinces = useMemo(() => {
    const ordre = [...ORDRE_PROVINCES, "Autres"];
    return ordre.filter((p) => parProvince.has(p));
  }, [parProvince]);

  const totalFiltres = filtres.length;
  const nbVilles = useMemo(() => new Set(filtres.map((p) => p.ville)).size, [filtres]);
  const nbProvs = useMemo(() => new Set(filtres.map((p) => p.province || "Autres")).size, [filtres]);

  const handleDownload = () => openReseauSoins().catch(() => toast.error("Ouverture du document impossible."));

  return (
    <div className="p-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-[1.35rem] font-bold text-foreground">Réseau de soins</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Prestataires conventionnés · classement par province et ville</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <FileDown className="w-3.5 h-3.5" />
          Télécharger PDF
        </button>
      </div>

      {/* Stat chips */}
      {tous !== null && (
        <div className="flex gap-3 mb-5 flex-wrap">
          {[
            { icon: Shield, label: `${totalFiltres} prestataire${totalFiltres !== 1 ? "s" : ""}`, color: "text-primary bg-primary/8 border-primary/15" },
            { icon: MapPinned, label: `${nbProvs} province${nbProvs !== 1 ? "s" : ""}`, color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400" },
            { icon: MapPin, label: `${nbVilles} ville${nbVilles !== 1 ? "s" : ""}`, color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400" },
          ].map(({ icon: Icon, label, color }) => (
            <span key={label} className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg border ${color}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </span>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="w-full sm:w-52">
          <Combobox options={types} value={typeChoisi} onChange={setTypeChoisi} getLabel={(t) => t} getId={(t) => t} allowClear clearLabel="Tous les types" placeholder="Filtrer par type…" />
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom, une ville, une spécialité…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground" />
          {recherche && <button type="button" onClick={() => setRecherche("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* Contenu */}
      {tous === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : provinces.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-[13px]">Aucun prestataire ne correspond à ces critères.</div>
      ) : (
        <div className="space-y-2">
          {provinces.map((prov) => {
            const gVille = parProvince.get(prov)!;
            const nbPrest = [...gVille.values()].reduce((s, v) => s + v.length, 0);
            const nbVillesProv = gVille.size;
            const ouvert = provinceOuverte === prov;
            const villes = [...gVille.keys()].sort((a, b) => a.localeCompare(b, "fr"));

            return (
              <div key={prov} className="rounded-xl overflow-hidden border border-border bg-card">
                {/* Bandeau province */}
                <button
                  type="button"
                  onClick={() => setProvinceOuverte(ouvert ? null : prov)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {provinceLabel(prov)}
                    </span>
                    <span className="text-[13.5px] font-bold uppercase tracking-wide">{prov}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] opacity-80">{nbPrest} prestataire{nbPrest !== 1 ? "s" : ""} · {nbVillesProv} ville{nbVillesProv !== 1 ? "s" : ""}</span>
                    {ouvert ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                </button>

                {ouvert && (
                  <div className="divide-y divide-border/60">
                    {villes.map((ville) => {
                      const prest = [...(gVille.get(ville) ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
                      return (
                        <div key={ville} className="p-4">
                          {/* Sous-titre ville */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{ville}</p>
                            <span className="text-[10.5px] text-muted-foreground">({prest.length})</span>
                          </div>
                          {/* Grille des prestataires */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-1.5">
                            {prest.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectionId(p.id)}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-secondary/40 transition-colors border border-transparent hover:border-border"
                              >
                                <span className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-lg flex-shrink-0 leading-none">{TYPE_ICONES[p.type] ?? "🏥"}</span>
                                  <span className="min-w-0">
                                    <span className="block text-[12.5px] font-medium text-foreground truncate">{p.titre ? `${p.titre} ` : ""}{p.nom}</span>
                                    <span className="block text-[11px] text-muted-foreground truncate">{p.type}{p.specialite ? ` · ${p.specialite.split("·")[0].trim()}` : ""}</span>
                                  </span>
                                </span>
                                <span className="flex items-center gap-1.5 flex-shrink-0">
                                  {p.secteur && <Badge variant={secteurVariant(p.secteur)}>{p.secteur}</Badge>}
                                  {p.latitude != null && <MapPin className="w-3 h-3 text-emerald-500" />}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détail */}
      {selectionId && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectionId(null)}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
                      {TYPE_ICONES[detail.type] ?? "🏥"}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-foreground">{detail.titre ? `${detail.titre} ` : ""}{detail.nom}</h3>
                      <p className="text-[11px] text-muted-foreground">{detail.type}{detail.specialite ? ` · ${detail.specialite}` : ""}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectionId(null)} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary/40"><X className="w-3.5 h-3.5" /></button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] p-3.5 rounded-xl bg-secondary/20 border border-border">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Adresse</p>
                        <p className="text-foreground">{detail.adresse ? `${detail.adresse}, ` : ""}{detail.ville}{detail.province ? `, ${detail.province}` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Téléphone</p>
                        <p className={detail.telephone ? "text-foreground" : "text-muted-foreground italic text-[12px]"}>{detail.telephone ?? "Non renseigné"}</p>
                      </div>
                    </div>
                    {detail.secteur && <div className="sm:col-span-2"><Badge variant={secteurVariant(detail.secteur)}>{detail.secteur}</Badge></div>}
                  </div>

                  {detail.latitude != null && detail.longitude != null ? (
                    <div className="h-56 rounded-xl overflow-hidden border border-border">
                      <MapContainer center={[detail.latitude, detail.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[detail.latitude, detail.longitude]}>
                          <Popup>{detail.nom}<br />{detail.adresse}</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="h-24 rounded-xl border border-dashed border-border flex items-center justify-center text-[12px] text-muted-foreground">
                      Coordonnées non disponibles pour ce prestataire.
                    </div>
                  )}

                  {detail.type !== "Médecin" && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Médecins ({detail.medecins.length})</p>
                      {detail.medecins.length === 0 ? (
                        <p className="text-[12.5px] text-muted-foreground italic">Aucun médecin rattaché à cet établissement.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {detail.medecins.map((m) => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/25">
                              <span className="text-[12.5px] text-foreground">{m.titre ? `${m.titre} ` : ""}{m.nom}</span>
                              <span className="text-[11.5px] text-muted-foreground">{m.specialite ?? "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}
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
