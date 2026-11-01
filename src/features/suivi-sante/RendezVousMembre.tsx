import { useEffect, useState } from "react";
import { CalendarPlus, Loader2, LocateFixed, Stethoscope, Users } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import {
  annulerRendezVous, dateHeureFr, getMesRendezVous, getProfessionnels, getStructuresMedicales, nomMedecin, prendreRendezVous,
  type Professionnel, type RendezVous, type StructureMedicale, type TypeRendezVous,
} from "@/services/suiviSante.service";
import { BadgeStatut, carte, champ, ChoixBeneficiaire, position, useBeneficiaires } from "./commun";

// "JJ/MM/AAAA" + "HH:MM" → ISO (heure locale) ; null si la date n'existe pas.
function versIso(jour: string, heure: string): string | null {
  const j = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(jour), h = /^(\d{1,2}):(\d{2})$/.exec(heure);
  if (!j || !h) return null;
  const d = new Date(Number(j[3]), Number(j[2]) - 1, Number(j[1]), Number(h[1]), Number(h[2]));
  return d.getDate() === Number(j[1]) ? d.toISOString() : null;
}

const aVenir = (r: RendezVous) => ["Demandé", "Confirmé"].includes(r.statut) && new Date(r.dateHeure).getTime() > Date.now() - 3600_000;

// Rendez-vous en ligne (2026-11) — voir demande utilisateur : "prise de
// rendez-vous en ligne, le suivi des rendez-vous et des contrôles de santé".
export default function MembreRendezVousView() {
  const beneficiaires = useBeneficiaires();
  const [liste, setListe] = useState<RendezVous[] | null>(null);
  const [assureId, setAssureId] = useState("");
  const [type, setType] = useState<TypeRendezVous>("Consultation");
  // Structure → spécialité → médecin de la structure (ou affecté par elle).
  const [structures, setStructures] = useState<StructureMedicale[]>([]);
  const [localisation, setLocalisation] = useState(false);
  const [structure, setStructure] = useState<StructureMedicale | null>(null);
  const [specialite, setSpecialite] = useState("");
  const [medecins, setMedecins] = useState<Professionnel[] | null>(null);
  const [medecin, setMedecin] = useState<Professionnel | null>(null);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("09:00");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = () => getMesRendezVous().then(setListe).catch((e) => { setListe([]); toast.error(e instanceof Error ? e.message : "Chargement impossible."); });
  useEffect(() => { charger(); }, []);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);
  useEffect(() => { getStructuresMedicales().then(setStructures).catch(() => undefined); }, []);
  useEffect(() => {
    setMedecin(null);
    if (!structure || !specialite) { setMedecins(null); return; }
    getProfessionnels({ prestataireId: structure.id, specialite }).then(setMedecins).catch(() => setMedecins([]));
  }, [structure, specialite]);

  const choisirStructure = (st: StructureMedicale | null) => {
    setStructure(st);
    setSpecialite(st?.specialites.length === 1 ? st.specialites[0] : "");
  };
  const autourDeMoi = async () => {
    setLocalisation(true);
    try { setStructures(await getStructuresMedicales(await position())); toast.success("Établissements triés du plus proche au plus éloigné."); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Position indisponible."); }
    finally { setLocalisation(false); }
  };

  const demander = async () => {
    if (!structure) { toast.error("Choisissez l'établissement."); return; }
    if (structure.specialites.length > 0 && !specialite) { toast.error("Choisissez la spécialité."); return; }
    const iso = versIso(jour, heure);
    if (!iso) { toast.error("Saisissez une date (JJ/MM/AAAA) et une heure valides."); return; }
    setEnvoi(true);
    try {
      await prendreRendezVous({ assureId, prestataireId: structure.id, medecinId: medecin?.id, specialite: specialite || undefined, type, motif: motif.trim() || undefined, dateHeure: iso });
      toast.success("Demande envoyée : vous serez notifié dès que le rendez-vous sera confirmé.");
      setMedecin(null); setMotif(""); setJour("");
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*"message":"([^"]+)".*$/, "$1") : "Demande impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const annuler = async (id: string) => {
    try { await annulerRendezVous(id); toast.success("Rendez-vous annulé."); charger(); } catch (err) { toast.error(err instanceof Error ? err.message : "Annulation impossible."); }
  };

  const prochains = (liste ?? []).filter(aVenir).sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
  const passes = (liste ?? []).filter((r) => !aVenir(r));

  const ligne = (r: RendezVous) => (
    <div key={r.id} className="bg-card border border-border rounded-xl p-3.5 flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{dateHeureFr(r.dateHeure)} · {r.type}{r.specialite && ` · ${r.specialite}`}</p>
        <p className="text-[12px] text-muted-foreground">
          {r.medecin ? nomMedecin(r.medecin) : "Médecin à affecter par l'établissement"}{r.prestataire && ` — ${r.prestataire.nom}`} · {r.assure.prenom ?? ""} {r.assure.nom}
        </p>
        {r.motif && <p className="text-[12px] text-muted-foreground">Motif : {r.motif}</p>}
        {r.reponse && <p className="text-[12px] text-foreground mt-1">Réponse : {r.reponse}</p>}
      </div>
      <BadgeStatut statut={r.statut} />
      {aVenir(r) && <button type="button" onClick={() => annuler(r.id)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Annuler</button>}
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Rendez-vous</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Choisissez l'établissement, la spécialité puis le médecin (ou laissez l'établissement vous en affecter un) et suivez la confirmation.</p>
      </div>

      <div className={`${carte} space-y-3`}>
        <p className="text-[13px] font-semibold text-foreground inline-flex items-center gap-2"><CalendarPlus className="w-4 h-4 text-primary" />Nouveau rendez-vous</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoixBeneficiaire liste={beneficiaires} valeur={assureId} onChange={setAssureId} />
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as TypeRendezVous)} className={champ}>
              <option>Consultation</option><option value="Contrôle">Contrôle de santé</option><option>Examen</option>
            </select>
          </label>
        </div>
        <div>
          <span className="text-[11.5px] text-muted-foreground">1. Établissement</span>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <Combobox options={structures} value={structure} onChange={choisirStructure} getLabel={(st) => st.nom} getId={(st) => st.id}
                getSubLabel={(st) => [st.type, st.ville, st.distanceKm !== null && `à ${st.distanceKm} km`, st.nbMedecins ? `${st.nbMedecins} médecin${st.nbMedecins > 1 ? "s" : ""}` : "aucun médecin enregistré"].filter(Boolean).join(" · ")}
                placeholder="Rechercher une clinique, un hôpital, un centre…" />
            </div>
            <button type="button" onClick={autourDeMoi} disabled={localisation} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground inline-flex items-center gap-1.5 hover:bg-secondary/40 disabled:opacity-60 whitespace-nowrap">
              {localisation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}Autour de moi
            </button>
          </div>
        </div>
        {structure && structure.specialites.length > 0 && (
          <div>
            <span className="text-[11.5px] text-muted-foreground">2. Spécialité / type de consultation</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {structure.specialites.map((sp) => (
                <button key={sp} type="button" aria-pressed={specialite === sp} onClick={() => setSpecialite(sp)}
                  className={`h-8 px-3 rounded-full border text-[12.5px] ${specialite === sp ? "bg-primary border-primary text-primary-foreground font-medium" : "border-border text-foreground hover:bg-secondary/40"}`}>{sp}</button>
              ))}
            </div>
          </div>
        )}
        {structure && structure.specialites.length === 0 && <p className="text-[12px] text-muted-foreground">Aucun médecin n'est encore enregistré dans cet établissement : il recevra votre demande et vous affectera un praticien.</p>}
        {specialite && (
          <div>
            <span className="text-[11.5px] text-muted-foreground">3. Médecin</span>
            {medecins === null ? <p className="text-[12px] text-muted-foreground py-2">Chargement…</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-1">
                <button type="button" onClick={() => setMedecin(null)} className={`rounded-xl border p-2.5 text-left flex items-start gap-2 ${!medecin ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"}`}>
                  <Users className="w-4 h-4 text-primary mt-0.5" />
                  <span><span className="block text-[13px] font-medium text-foreground">Premier médecin disponible</span><span className="block text-[11.5px] text-muted-foreground">L'établissement vous affecte un praticien ({specialite})</span></span>
                </button>
                {medecins.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMedecin(m)} className={`rounded-xl border p-2.5 text-left flex items-start gap-2 ${medecin?.id === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"}`}>
                    <Stethoscope className="w-4 h-4 text-primary mt-0.5" />
                    <span><span className="block text-[13px] font-medium text-foreground">{nomMedecin(m)}</span><span className="block text-[11.5px] text-muted-foreground">{m.specialite ?? "Médecine générale"}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><span className="text-[11.5px] text-muted-foreground">Date</span><DateInput value={jour} onChange={setJour} className={champ} /></div>
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Heure</span><input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} /></label>
          <label className="block col-span-2"><span className="text-[11.5px] text-muted-foreground">Motif (facultatif)</span><input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. fièvre depuis 3 jours, renouvellement d'ordonnance" className={champ} /></label>
        </div>
        <button type="button" onClick={demander} disabled={envoi} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60">
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />}Demander le rendez-vous{medecin ? ` — ${nomMedecin(medecin)}` : structure ? ` — ${structure.nom}` : ""}
        </button>
      </div>

      <h2 className="text-[14px] font-semibold text-foreground">À venir</h2>
      {liste === null ? <p className="text-[12.5px] text-muted-foreground">Chargement…</p>
        : prochains.length === 0 ? <p className="text-[12.5px] text-muted-foreground">Aucun rendez-vous à venir.</p>
        : <div className="space-y-2">{prochains.map(ligne)}</div>}
      {passes.length > 0 && (<><h2 className="text-[14px] font-semibold text-foreground pt-2">Historique</h2><div className="space-y-2">{passes.map(ligne)}</div></>)}
    </div>
  );
}
