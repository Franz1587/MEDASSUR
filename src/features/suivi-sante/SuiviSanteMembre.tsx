import { useEffect, useMemo, useState } from "react";
import { Activity, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ajouterMesure, dateHeureFr, getMesMesures, getMesRendezVous, nomMedecin, supprimerMesure, TYPES_MESURE, UNITE_MESURE, type MesureSante, type RendezVous } from "@/services/suiviSante.service";
import { BadgeStatut, carte, champ, ChoixBeneficiaire, useBeneficiaires } from "./commun";

// Suivi de santé (2026-11) : constantes relevées par l'assuré ou par un
// médecin autorisé, et prochains contrôles de santé programmés.
export default function MembreSuiviSanteView() {
  const beneficiaires = useBeneficiaires();
  const [mesures, setMesures] = useState<MesureSante[] | null>(null);
  const [controles, setControles] = useState<RendezVous[]>([]);
  const [assureId, setAssureId] = useState("");
  const [type, setType] = useState<string>("Tension");
  const [valeur, setValeur] = useState("");
  const [note, setNote] = useState("");

  const charger = () => {
    getMesMesures().then(setMesures).catch(() => setMesures([]));
    getMesRendezVous().then((r) => setControles(r.filter((x) => x.type === "Contrôle" && ["Demandé", "Confirmé"].includes(x.statut) && new Date(x.dateHeure).getTime() > Date.now()))).catch(() => undefined);
  };
  useEffect(() => { charger(); }, []);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);

  const enregistrer = async () => {
    if (!valeur.trim()) { toast.error("Indiquez la valeur mesurée."); return; }
    try {
      await ajouterMesure({ assureId, type, valeur: valeur.trim(), unite: UNITE_MESURE[type], note: note.trim() || undefined });
      setValeur(""); setNote("");
      toast.success("Mesure enregistrée.");
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    }
  };

  const supprimer = async (id: string) => {
    try { await supprimerMesure(id); charger(); } catch (err) { toast.error(err instanceof Error ? err.message : "Suppression impossible."); }
  };

  const duBeneficiaire = useMemo(() => (mesures ?? []).filter((m) => m.assureId === assureId), [mesures, assureId]);
  const parType = useMemo(() => TYPES_MESURE.map((t) => ({ type: t, lignes: duBeneficiaire.filter((m) => m.type === t) })).filter((g) => g.lignes.length), [duBeneficiaire]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Suivi de santé</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Vos constantes (tension, glycémie, poids…) et vos contrôles de santé, consultables par les médecins à qui vous ouvrez votre dossier.</p>
      </div>

      {controles.length > 0 && (
        <div className={`${carte} space-y-2`}>
          <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" />Prochains contrôles</p>
          {controles.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 text-[12.5px] text-foreground">
              <span className="font-medium">{dateHeureFr(c.dateHeure)}</span>
              <span className="text-muted-foreground">— {c.medecin ? nomMedecin(c.medecin) : c.prestataire?.nom} · {c.assure.prenom ?? ""} {c.assure.nom}</span>
              <BadgeStatut statut={c.statut} />
            </div>
          ))}
        </div>
      )}

      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Nouvelle mesure</p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <ChoixBeneficiaire liste={beneficiaires} valeur={assureId} onChange={setAssureId} />
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={champ}>{TYPES_MESURE.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Valeur{UNITE_MESURE[type] ? ` (${UNITE_MESURE[type]})` : ""}</span>
            <input value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder={type === "Tension" ? "ex. 12/8" : ""} className={champ} />
          </label>
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="à jeun, après effort…" className={champ} /></label>
        </div>
        <button type="button" onClick={enregistrer} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium">Enregistrer</button>
      </div>

      {mesures === null ? <p className="text-[12.5px] text-muted-foreground">Chargement…</p>
        : parType.length === 0 ? <p className="text-[12.5px] text-muted-foreground">Aucune mesure enregistrée pour l'instant.</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {parType.map((g) => (
              <div key={g.type} className={carte}>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[13px] font-semibold text-foreground">{g.type}</p>
                  <p className="text-[18px] font-bold text-primary">{g.lignes[0].valeur} <span className="text-[12px] font-normal text-muted-foreground">{g.lignes[0].unite ?? ""}</span></p>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {g.lignes.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-[12px]">
                      <span className="text-muted-foreground w-36 flex-shrink-0">{new Date(m.dateMesure).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className="text-foreground font-medium">{m.valeur} {m.unite ?? ""}</span>
                      <span className="text-muted-foreground truncate flex-1">{m.medecinId ? "· saisi par votre médecin" : ""}{m.note ? ` · ${m.note}` : ""}</span>
                      {!m.medecinId && <button type="button" onClick={() => supprimer(m.id)} aria-label="Supprimer la mesure" className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
