import { useEffect, useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { annulerRendezVous, dateHeureFr, getMesRendezVous, nomMedecin, prendreRendezVous, type RendezVous, type TypeRendezVous } from "@/services/suiviSante.service";
import { BadgeStatut, carte, champ, ChoixBeneficiaire, ChoixProfessionnel, useBeneficiaires, type ChoixPro } from "./commun";

const aVenir = (r: RendezVous) => ["Demandé", "Confirmé"].includes(r.statut) && new Date(r.dateHeure).getTime() > Date.now() - 3600_000;

// Rendez-vous en ligne (2026-11) — voir demande utilisateur : "prise de
// rendez-vous en ligne, le suivi des rendez-vous et des contrôles de santé".
export default function MembreRendezVousView() {
  const beneficiaires = useBeneficiaires();
  const [liste, setListe] = useState<RendezVous[] | null>(null);
  const [assureId, setAssureId] = useState("");
  const [type, setType] = useState<TypeRendezVous>("Consultation");
  const [pro, setPro] = useState<ChoixPro | null>(null);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("09:00");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = () => getMesRendezVous().then(setListe).catch((e) => { setListe([]); toast.error(e instanceof Error ? e.message : "Chargement impossible."); });
  useEffect(() => { charger(); }, []);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);

  const demander = async () => {
    if (!pro) { toast.error("Choisissez un médecin ou un établissement."); return; }
    if (!jour || !heure) { toast.error("Choisissez la date et l'heure souhaitées."); return; }
    setEnvoi(true);
    try {
      await prendreRendezVous({ assureId, medecinId: pro.medecin?.id, prestataireId: pro.prestataireId ?? undefined, type, motif: motif.trim() || undefined, dateHeure: new Date(`${jour}T${heure}`).toISOString() });
      toast.success("Demande envoyée : vous serez notifié dès que le rendez-vous sera confirmé.");
      setPro(null); setMotif(""); setJour("");
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
        <p className="text-[13px] font-semibold text-foreground">{dateHeureFr(r.dateHeure)} · {r.type}</p>
        <p className="text-[12px] text-muted-foreground">
          {r.medecin ? nomMedecin(r.medecin) : r.prestataire?.nom}{r.medecin && r.prestataire && ` — ${r.prestataire.nom}`} · {r.assure.prenom ?? ""} {r.assure.nom}
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
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Prenez rendez-vous avec un médecin ou un établissement du réseau et suivez sa confirmation.</p>
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
        <ChoixProfessionnel valeur={pro} onChange={setPro} avecEtablissement />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Date</span><input type="date" value={jour} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setJour(e.target.value)} className={champ} /></label>
          <label className="block"><span className="text-[11.5px] text-muted-foreground">Heure</span><input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} /></label>
          <label className="block col-span-2"><span className="text-[11.5px] text-muted-foreground">Motif (facultatif)</span><input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="ex. fièvre depuis 3 jours, renouvellement d'ordonnance" className={champ} /></label>
        </div>
        <button type="button" onClick={demander} disabled={envoi} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60">
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />}Demander le rendez-vous{pro ? ` — ${pro.libelle}` : ""}
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
