import "leaflet/dist/leaflet.css";
import "@/lib/leafletIconFix";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin, Phone, Building2, Stethoscope, Search, X, ArrowLeft } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { getReseauSoins, getPrestataireReseau, type PrestataireReseau, type PrestataireReseauDetail } from "@/services/reseauSoins.service";

function secteurVariant(secteur?: string | null): BadgeVariant {
  return secteur === "Public" ? "info" : secteur === "Privé" ? "gold" : "neutral";
}

// Réseau de soins (2026-08) — voir demande utilisateur : "écran externe
// dédié à l'assuré principal", modelé sur des maquettes de référence
// fournies par l'utilisateur : grille de catégories tapables en entrée, puis liste
// filtrée + carte, au lieu de l'accordéon type→ville du portail client
// (src/features/portail-client/ReseauSoins.tsx, plus adapté à un usage
// back-office). Mêmes services backend, aucun changement serveur —
// catégories dérivées des `type` réels du réseau (texte libre), pas une
// liste figée qui ne correspondrait pas à la taxonomie MedAssur.
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
    return [...compteurs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tous]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (tous ?? []).filter((p) => {
      if (categorie && p.type !== categorie) return false;
      if (q && !`${p.nom} ${p.specialite ?? ""} ${p.ville}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => a.nom.localeCompare(b.nom));
  }, [tous, categorie, recherche]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Réseau de soins</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Trouvez un prestataire conventionné près de vous</p>
      </div>

      {!categorie ? (
        <>
          {tous === null ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
              {categories.map(([type, n]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCategorie(type)}
                  className="bg-card border border-border rounded-2xl p-4 flex flex-col items-start gap-2 hover:border-primary/40 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[13px] font-semibold text-foreground">{type}</span>
                  <span className="text-[11px] text-muted-foreground">{n} prestataire(s)</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCategorie(null)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-[13px] font-semibold text-foreground">{categorie}</p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom, une ville…" className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
          </div>

          {filtres.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun prestataire ne correspond à ces critères.</div>
          ) : (
            <div className="space-y-1.5">
              {filtres.map((p) => (
                <button key={p.id} type="button" onClick={() => setSelectionId(p.id)} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 bg-card border border-border rounded-xl text-left hover:border-primary/40 transition-colors">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0"><Building2 className="w-3.5 h-3.5 text-primary" /></div>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-foreground truncate">{p.titre ? `${p.titre} ` : ""}{p.nom}</span>
                      <span className="block text-[11.5px] text-muted-foreground truncate">{p.specialite ? `${p.specialite} · ` : ""}{p.ville}</span>
                    </span>
                  </span>
                  {p.secteur && <Badge variant={secteurVariant(p.secteur)}>{p.secteur}</Badge>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectionId && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setSelectionId(null)}>
          <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!detail ? (
              <div className="p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
            ) : (
              <>
                <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-primary/12 rounded-lg flex-shrink-0"><Building2 className="w-4.5 h-4.5 text-primary" /></div>
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
                      <p className="text-foreground">{detail.adresse ? `${detail.adresse}, ` : ""}{detail.ville}, {detail.pays}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <p className={detail.telephone ? "text-foreground" : "text-muted-foreground italic"}>{detail.telephone ?? "Non renseigné"}</p>
                    </div>
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
                    <div className="h-28 rounded-xl border border-dashed border-border flex items-center justify-center text-[12px] text-muted-foreground">
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
