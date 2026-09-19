import "leaflet/dist/leaflet.css";
import "@/lib/leafletIconFix";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin, Phone, Building2, Stethoscope, Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { getReseauSoins, getPrestataireReseau, type PrestataireReseau, type PrestataireReseauDetail } from "@/services/reseauSoins.service";

function secteurVariant(secteur?: string | null): BadgeVariant {
  return secteur === "Public" ? "info" : secteur === "Privé" ? "gold" : "neutral";
}

interface Groupe { type: string; villes: { ville: string; prestataires: PrestataireReseau[] }[] }

// Réseau de soins (2026-08) — voir demande utilisateur : "on aura la liste
// des prestataires réseau rangé par type et par ville... on doit pouvoir
// géolocaliser un prestataire... en cliquant sur le prestataire, on doit
// avoir ses coordonnées, la liste des médecins selon les spécialités qui
// interviennent chez eux". Carte intégrée dans l'application (pas de
// renvoi vers un onglet externe, voir demande utilisateur).
export default function PortailReseauSoinsView() {
  const [tous, setTous] = useState<PrestataireReseau[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [typeChoisi, setTypeChoisi] = useState<string | null>(null);
  const [villeChoisie, setVilleChoisie] = useState<string | null>(null);
  const [typesOuverts, setTypesOuverts] = useState<Set<string>>(new Set());
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrestataireReseauDetail | null>(null);

  useEffect(() => {
    getReseauSoins().then((liste) => {
      setTous(liste);
      setTypesOuverts(new Set(liste.map((p) => p.type)));
    });
  }, []);

  useEffect(() => {
    if (!selectionId) { setDetail(null); return; }
    setDetail(null);
    getPrestataireReseau(selectionId).then(setDetail);
  }, [selectionId]);

  const types = useMemo(() => [...new Set((tous ?? []).map((p) => p.type))].sort(), [tous]);
  const villes = useMemo(() => [...new Set((tous ?? []).map((p) => p.ville))].sort(), [tous]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (tous ?? []).filter((p) => {
      if (typeChoisi && p.type !== typeChoisi) return false;
      if (villeChoisie && p.ville !== villeChoisie) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tous, typeChoisi, villeChoisie, recherche]);

  // Rangé par type puis par ville — voir demande utilisateur.
  const groupes: Groupe[] = useMemo(() => {
    const parType = new Map<string, Map<string, PrestataireReseau[]>>();
    for (const p of filtres) {
      const gType = parType.get(p.type) ?? new Map<string, PrestataireReseau[]>();
      const gVille = gType.get(p.ville) ?? [];
      gVille.push(p);
      gType.set(p.ville, gVille);
      parType.set(p.type, gType);
    }
    return [...parType.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, gVille]) => ({
        type,
        villes: [...gVille.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ville, prestataires]) => ({
          ville, prestataires: prestataires.sort((a, b) => a.nom.localeCompare(b.nom)),
        })),
      }));
  }, [filtres]);

  const toggleType = (t: string) => setTypesOuverts((v) => {
    const next = new Set(v);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-[1.35rem] font-bold text-foreground">Réseau de soins</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{filtres.length} prestataire(s) conventionné(s)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="w-full sm:w-56">
          <Combobox options={types} value={typeChoisi} onChange={setTypeChoisi} getLabel={(t) => t} getId={(t) => t} allowClear clearLabel="Tous les types" placeholder="Filtrer par type…" />
        </div>
        <div className="w-full sm:w-56">
          <Combobox options={villes} value={villeChoisie} onChange={setVilleChoisie} getLabel={(v) => v} getId={(v) => v} allowClear clearLabel="Toutes les villes" placeholder="Filtrer par ville…" />
        </div>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom, une spécialité…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
        </div>
      </div>

      {tous === null ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : groupes.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun prestataire ne correspond à ces critères.</div>
      ) : (
        <div className="space-y-3">
          {groupes.map((g) => {
            const total = g.villes.reduce((s, v) => s + v.prestataires.length, 0);
            const ouvert = typesOuverts.has(g.type);
            return (
              <div key={g.type} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button type="button" onClick={() => toggleType(g.type)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/25">
                  <span className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
                    {ouvert ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    {g.type}
                    <span className="text-[11px] font-normal text-muted-foreground">({total})</span>
                  </span>
                </button>
                {ouvert && (
                  <div className="divide-y divide-border/60 border-t border-border">
                    {g.villes.map((v) => (
                      <div key={v.ville} className="p-4">
                        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{v.ville} ({v.prestataires.length})</p>
                        <div className="space-y-1.5">
                          {v.prestataires.map((p) => (
                            <button key={p.id} type="button" onClick={() => setSelectionId(p.id)} className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-secondary/30 transition-colors">
                              <span className="flex items-center gap-2.5 min-w-0">
                                <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0"><Building2 className="w-3.5 h-3.5 text-primary" /></div>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium text-foreground truncate">{p.titre ? `${p.titre} ` : ""}{p.nom}</span>
                                  {p.specialite && <span className="block text-[11.5px] text-muted-foreground truncate">{p.specialite}</span>}
                                </span>
                              </span>
                              <span className="flex items-center gap-2 flex-shrink-0">
                                {p.secteur && <Badge variant={secteurVariant(p.secteur)}>{p.secteur}</Badge>}
                                {p.latitude != null && <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectionId && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" onClick={() => setSelectionId(null)}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-primary/12 rounded-lg"><Building2 className="w-4.5 h-4.5 text-primary" /></div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-foreground">{detail.titre ? `${detail.titre} ` : ""}{detail.nom}</h3>
                      <p className="text-[11px] text-muted-foreground">{detail.type}{detail.specialite ? ` · ${detail.specialite}` : ""}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectionId(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40"><X className="w-3.5 h-3.5" /></button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] p-3 rounded-xl bg-secondary/20 border border-border">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Adresse</p>
                        <p className="text-foreground">{detail.adresse ? `${detail.adresse}, ` : ""}{detail.ville}, {detail.pays}</p>
                        {!detail.adresse && <p className="text-[11px] text-muted-foreground italic">Adresse précise non renseignée</p>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Téléphone</p>
                        <p className={detail.telephone ? "text-foreground" : "text-muted-foreground italic"}>{detail.telephone ?? "Non renseigné"}</p>
                      </div>
                    </div>
                    {detail.secteur && <div className="flex items-center gap-2 sm:col-span-2"><Badge variant={secteurVariant(detail.secteur)}>{detail.secteur}</Badge></div>}
                  </div>

                  {detail.latitude != null && detail.longitude != null ? (
                    <div className="h-64 rounded-xl overflow-hidden border border-border">
                      <MapContainer center={[detail.latitude, detail.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
                        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker position={[detail.latitude, detail.longitude]}>
                          <Popup>{detail.nom}<br />{detail.adresse}</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="h-32 rounded-xl border border-dashed border-border flex items-center justify-center text-[12.5px] text-muted-foreground">
                      Coordonnées non disponibles pour ce prestataire.
                    </div>
                  )}

                  {detail.type !== "Médecin" && (
                    <div>
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Médecins ({detail.medecins.length})</p>
                      {detail.medecins.length === 0 ? (
                        <p className="text-[12.5px] text-muted-foreground">Aucun médecin rattaché à cet établissement.</p>
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
