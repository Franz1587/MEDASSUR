import { useEffect, useState } from "react";
import { LocateFixed, Loader2, MapPin, Search, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { getMaFamille, getMoi } from "@/services/portailMembre.service";
import { getReseauSoins, type PrestataireReseau } from "@/services/reseauSoins.service";
import { getProfessionnels, nomMedecin, type Professionnel, type StatutRendezVous } from "@/services/suiviSante.service";

export const champ = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground";
export const carte = "bg-card border border-border rounded-2xl p-4";

const VARIANTE_STATUT: Record<StatutRendezVous, BadgeVariant> = {
  Demandé: "warning", Confirmé: "success", Refusé: "danger", Annulé: "neutral", Honoré: "info", Absent: "neutral",
};
export const BadgeStatut = ({ statut }: { statut: StatutRendezVous }) => <Badge variant={VARIANTE_STATUT[statut]}>{statut === "Demandé" ? "En attente" : statut}</Badge>;

export interface Beneficiaire { id: string; nom: string; vous: boolean }

// L'assuré et les ayants droit de sa famille.
export function useBeneficiaires() {
  const [liste, setListe] = useState<Beneficiaire[]>([]);
  useEffect(() => {
    Promise.all([getMoi(), getMaFamille()]).then(([moi, famille]) => setListe([
      { id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim(), vous: true },
      ...famille.map((m) => ({ id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim(), vous: false })),
    ])).catch(() => undefined);
  }, []);
  return liste;
}

export function ChoixBeneficiaire({ liste, valeur, onChange }: { liste: Beneficiaire[]; valeur: string; onChange: (id: string) => void }) {
  if (liste.length < 2) return null;
  return (
    <label className="block"><span className="text-[11.5px] text-muted-foreground">Pour</span>
      <Combobox options={liste} value={liste.find((b) => b.id === valeur) ?? null} onChange={(b) => b && onChange(b.id)} getLabel={(b) => (b.vous ? `${b.nom} (vous)` : b.nom)} getId={(b) => b.id} />
    </label>
  );
}

export function position(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("La géolocalisation n'est pas disponible sur cet appareil.")); return; }
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => reject(new Error("Position refusée ou indisponible : autorisez la localisation.")), { enableHighAccuracy: true, timeout: 15000 });
  });
}

export interface ChoixPro { medecin: Professionnel | null; prestataireId: string | null; libelle: string }

// Médecins du réseau (recherche, ou triés par distance autour de l'assuré) ;
// `avecEtablissement` permet aussi de viser un établissement sans médecin précis.
export function ChoixProfessionnel({ valeur, onChange, avecEtablissement = false }: { valeur: ChoixPro | null; onChange: (c: ChoixPro | null) => void; avecEtablissement?: boolean }) {
  const [mode, setMode] = useState<"medecin" | "etablissement">("medecin");
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pros, setPros] = useState<Professionnel[] | null>(null);
  const [localisation, setLocalisation] = useState(false);
  const [structures, setStructures] = useState<PrestataireReseau[]>([]);

  useEffect(() => {
    const t = setTimeout(() => getProfessionnels({ q: q.trim() || undefined, ...(pos ?? {}) }).then(setPros).catch(() => setPros([])), 250);
    return () => clearTimeout(t);
  }, [q, pos]);
  useEffect(() => { if (avecEtablissement) getReseauSoins().then(setStructures).catch(() => undefined); }, [avecEtablissement]);

  const autourDeMoi = async () => {
    setLocalisation(true);
    try { setPos(await position()); } catch (err) { toast.error(err instanceof Error ? err.message : "Position indisponible."); } finally { setLocalisation(false); }
  };

  return (
    <div className="space-y-2">
      {avecEtablissement && (
        <div className="inline-flex rounded-lg border border-border p-1 bg-secondary/30" role="tablist">
          {([["medecin", "Un médecin"], ["etablissement", "Un établissement"]] as const).map(([m, l]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); onChange(null); }} className={`h-8 px-3 rounded-md text-[12.5px] ${mode === m ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      )}
      {mode === "etablissement" ? (
        <Combobox options={structures} value={structures.find((s) => s.id === valeur?.prestataireId) ?? null}
          onChange={(s) => onChange(s ? { medecin: null, prestataireId: s.id, libelle: s.nom } : null)}
          getLabel={(s) => s.nom} getSubLabel={(s) => [s.type, s.ville].filter(Boolean).join(" · ")} getId={(s) => s.id} placeholder="Rechercher un établissement…" />
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou spécialité du médecin" aria-label="Rechercher un médecin" className={`${champ} pl-8`} />
            </div>
            <button type="button" onClick={autourDeMoi} disabled={localisation} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/40 disabled:opacity-60 whitespace-nowrap">
              {localisation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}Autour de moi
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {pros === null ? <p className="text-[12px] text-muted-foreground py-2">Chargement…</p>
              : pros.length === 0 ? <p className="text-[12px] text-muted-foreground py-2">Aucun médecin trouvé.</p>
              : pros.map((m) => (
                <div key={m.id} className={`rounded-xl border p-2.5 ${valeur?.medecin?.id === m.id ? "border-primary bg-primary/5" : "border-border"}`}>
                  <button type="button" onClick={() => onChange({ medecin: m, prestataireId: m.structures[0]?.id ?? null, libelle: nomMedecin(m) })} className="w-full text-left flex items-start gap-2">
                    <Stethoscope className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-foreground">{nomMedecin(m)}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{m.specialite ?? "Médecine générale"}{m.distanceKm !== null && ` · à ${m.distanceKm} km`}</span>
                    </span>
                  </button>
                  {valeur?.medecin?.id === m.id && m.structures.length > 0 && (
                    <div className="mt-2 pl-6 space-y-1">
                      {m.structures.map((s) => (
                        <label key={s.id} className="flex items-start gap-2 text-[12px] text-foreground cursor-pointer">
                          <input type="radio" name={`structure-${m.id}`} checked={valeur.prestataireId === s.id} onChange={() => onChange({ ...valeur, prestataireId: s.id })} className="mt-0.5 accent-primary" />
                          <span><MapPin className="w-3 h-3 inline text-muted-foreground" /> {s.nom}{s.ville && ` — ${s.ville}`}{s.distanceKm !== null && ` (${s.distanceKm} km)`}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
