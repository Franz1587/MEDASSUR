import { useEffect, useState } from "react";
import { CalendarClock, Phone } from "lucide-react";
import { toast } from "sonner";
import { dateHeureFr, getRendezVousPro, nomMedecin, repondreRendezVous, type Espace, type RendezVous } from "@/services/suiviSante.service";
import { BadgeStatut, champ } from "./commun";

type Onglet = "traiter" | "venir" | "passes";
const versLocal = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// Rendez-vous reçus (2026-11) — le médecin (et l'établissement) sont alertés
// à chaque demande avec la date et l'heure, puis confirment, déplacent ou
// refusent ; le patient est notifié de la réponse.
function RendezVousPro({ espace }: { espace: Espace }) {
  const [liste, setListe] = useState<RendezVous[] | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("traiter");
  const [edition, setEdition] = useState<{ id: string; mode: "confirmer" | "refuser"; dateHeure: string; message: string } | null>(null);

  const charger = () => getRendezVousPro(espace).then(setListe).catch(() => setListe([]));
  useEffect(() => { charger(); }, [espace]);

  const maintenant = Date.now();
  const groupes: Record<Onglet, RendezVous[]> = {
    traiter: (liste ?? []).filter((r) => r.statut === "Demandé"),
    venir: (liste ?? []).filter((r) => r.statut === "Confirmé" && new Date(r.dateHeure).getTime() > maintenant - 3600_000),
    passes: (liste ?? []).filter((r) => !["Demandé"].includes(r.statut) && !(r.statut === "Confirmé" && new Date(r.dateHeure).getTime() > maintenant - 3600_000)).reverse(),
  };

  const repondre = async (id: string, statut: "Confirmé" | "Refusé" | "Honoré" | "Absent", extra: { reponse?: string; dateHeure?: string } = {}) => {
    try {
      await repondreRendezVous(espace, id, { statut, ...extra });
      toast.success(statut === "Confirmé" ? "Rendez-vous confirmé : le patient est prévenu." : statut === "Refusé" ? "Rendez-vous refusé : le patient est prévenu." : "Rendez-vous mis à jour.");
      setEdition(null);
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*"message":"([^"]+)".*$/, "$1") : "Mise à jour impossible.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">Rendez-vous</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">Demandes de rendez-vous des assurés : confirmez (à l'heure demandée ou à un autre horaire), refusez, puis indiquez si le patient est venu.</p>
      </div>
      <div className="inline-flex rounded-lg border border-border p-1 bg-secondary/30" role="tablist">
        {([["traiter", "À traiter"], ["venir", "À venir"], ["passes", "Passés"]] as const).map(([o, l]) => (
          <button key={o} type="button" role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)} className={`h-9 px-3 rounded-md text-[13px] ${onglet === o ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground"}`}>
            {l}{groupes[o].length > 0 && o !== "passes" ? ` (${groupes[o].length})` : ""}
          </button>
        ))}
      </div>
      {liste === null ? <p className="text-[12.5px] text-muted-foreground">Chargement…</p>
        : groupes[onglet].length === 0 ? <p className="text-[12.5px] text-muted-foreground">Aucun rendez-vous.</p>
        : (
          <div className="space-y-2">
            {groupes[onglet].map((r) => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-3.5 space-y-2">
                <div className="flex flex-wrap items-start gap-3">
                  <CalendarClock className="w-5 h-5 text-primary mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">{dateHeureFr(r.dateHeure)} · {r.type}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {r.assure.prenom ?? ""} {r.assure.nom} <span className="text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{r.assure.matricule}</span>
                      {r.assure.telephone && <> · <Phone className="w-3 h-3 inline" /> {r.assure.telephone}</>}
                      {espace === "prestataire" && r.medecin && ` · avec ${nomMedecin(r.medecin)}`}
                      {espace === "medecin" && r.prestataire && ` · ${r.prestataire.nom}`}
                    </p>
                    {r.motif && <p className="text-[12px] text-muted-foreground">Motif : {r.motif}</p>}
                    {r.reponse && <p className="text-[12px] text-foreground">Votre réponse : {r.reponse}</p>}
                  </div>
                  <BadgeStatut statut={r.statut} />
                </div>
                {edition?.id === r.id ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-2 items-end pl-8">
                    {edition.mode === "confirmer" && (
                      <label className="block"><span className="text-[11.5px] text-muted-foreground">Date et heure</span>
                        <input type="datetime-local" value={edition.dateHeure} onChange={(e) => setEdition({ ...edition, dateHeure: e.target.value })} className={champ} />
                      </label>
                    )}
                    <label className={`block ${edition.mode === "refuser" ? "sm:col-span-2" : ""}`}><span className="text-[11.5px] text-muted-foreground">{edition.mode === "refuser" ? "Motif du refus (envoyé au patient)" : "Message au patient (facultatif)"}</span>
                      <input value={edition.message} onChange={(e) => setEdition({ ...edition, message: e.target.value })} className={champ} />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEdition(null)} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-foreground">Annuler</button>
                      <button type="button"
                        onClick={() => edition.mode === "confirmer"
                          ? repondre(r.id, "Confirmé", { reponse: edition.message || undefined, dateHeure: new Date(edition.dateHeure).toISOString() })
                          : repondre(r.id, "Refusé", { reponse: edition.message })}
                        className={`h-9 px-3 rounded-lg text-[12.5px] font-medium text-white ${edition.mode === "confirmer" ? "bg-primary" : "bg-red-600"}`}>
                        {edition.mode === "confirmer" ? "Confirmer" : "Refuser"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pl-8">
                    {r.statut === "Demandé" && <>
                      <button type="button" onClick={() => setEdition({ id: r.id, mode: "confirmer", dateHeure: versLocal(r.dateHeure), message: "" })} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium">Confirmer</button>
                      <button type="button" onClick={() => setEdition({ id: r.id, mode: "refuser", dateHeure: "", message: "" })} className="h-8 px-3 rounded-lg border border-red-300 text-red-700 text-[12px] font-medium hover:bg-red-50">Refuser</button>
                    </>}
                    {r.statut === "Confirmé" && <>
                      <button type="button" onClick={() => setEdition({ id: r.id, mode: "confirmer", dateHeure: versLocal(r.dateHeure), message: "" })} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Déplacer</button>
                      <button type="button" onClick={() => repondre(r.id, "Honoré")} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Patient venu</button>
                      <button type="button" onClick={() => repondre(r.id, "Absent")} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Absent</button>
                    </>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

export const MedecinRendezVousView = () => <RendezVousPro espace="medecin" />;
export const PrestataireRendezVousView = () => <RendezVousPro espace="prestataire" />;
