import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock, Phone, Check, X } from "lucide-react";
import { toast } from "sonner";
import { getMedecinsPrestataire, type MedecinPrestataireOption } from "@/services/portailPrestataire.service";
import { getRendezVousPro, repondreRendezVous, dateHeureFr, nomMedecin, type RendezVous } from "@/services/suiviSante.service";
import { Badge } from "@/components/shared/Badge";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function jourSemaine(d: Date) { return (d.getDay() + 6) % 7; } // 0=Lun…6=Dim

function statColor(s: string): string {
  if (s === "Confirmé") return "bg-green-500";
  if (s === "Refusé" || s === "Annulé") return "bg-red-400";
  if (s === "Honoré") return "bg-blue-500";
  if (s === "Absent") return "bg-gray-400";
  return "bg-amber-400"; // Demandé
}

function isoJour(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendrierRendezVousView() {
  const aujourd = new Date();
  const [annee, setAnnee] = useState(aujourd.getFullYear());
  const [mois, setMois] = useState(aujourd.getMonth());
  const [rdvs, setRdvs] = useState<RendezVous[] | null>(null);
  const [jourActif, setJourActif] = useState<string | null>(null);
  const [medecins, setMedecins] = useState<MedecinPrestataireOption[]>([]);
  const [edition, setEdition] = useState<{ id: string; dateHeure: string; medecinId: string; message: string } | null>(null);

  const charger = () => getRendezVousPro("prestataire").then(setRdvs).catch(() => setRdvs([]));
  useEffect(() => { charger(); getMedecinsPrestataire().then(setMedecins).catch(() => undefined); }, []);

  // Regrouper par jour (clé YYYY-MM-DD)
  const parJour: Record<string, RendezVous[]> = {};
  for (const r of rdvs ?? []) {
    const k = isoJour(new Date(r.dateHeure));
    (parJour[k] ??= []).push(r);
  }

  // Navigation
  const moisPrec = () => { if (mois === 0) { setMois(11); setAnnee(a => a - 1); } else setMois(m => m - 1); };
  const moisSuiv = () => { if (mois === 11) { setMois(0); setAnnee(a => a + 1); } else setMois(m => m + 1); };

  // Grille du mois
  const premier = new Date(annee, mois, 1);
  const dernierJour = new Date(annee, mois + 1, 0).getDate();
  const decalage = jourSemaine(premier);
  const cases: (number | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: dernierJour }, (_, i) => i + 1)];
  while (cases.length % 7 !== 0) cases.push(null);

  const rdvJour = jourActif ? (parJour[jourActif] ?? []) : [];
  const toujourdHui = isoJour(aujourd);

  const repondre = async (id: string, statut: "Confirmé" | "Refusé", extra: { reponse?: string; dateHeure?: string; medecinId?: string } = {}) => {
    try {
      await repondreRendezVous("prestataire", id, { statut, ...extra });
      toast.success(statut === "Confirmé" ? "Rendez-vous confirmé." : "Rendez-vous refusé.");
      setEdition(null);
      charger();
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*"message":"([^"]+)".*$/, "$1") : "Mise à jour impossible.");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Calendrier des rendez-vous</h1>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Calendrier ── */}
        <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden">
          {/* En-tête mois */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <button type="button" onClick={moisPrec} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-[14px] font-semibold text-foreground">{MOIS[mois]} {annee}</span>
            <button type="button" onClick={moisSuiv} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 border-b border-border">
            {JOURS.map((j) => (
              <div key={j} className="py-2 text-center text-[11px] font-semibold text-muted-foreground">{j}</div>
            ))}
          </div>
          {/* Cases */}
          <div className="grid grid-cols-7">
            {cases.map((num, i) => {
              if (!num) return <div key={i} className="min-h-[68px] border-b border-r border-border/40" />;
              const clé = `${annee}-${String(mois + 1).padStart(2, "0")}-${String(num).padStart(2, "0")}`;
              const rdvsCase = parJour[clé] ?? [];
              const estAujourd = clé === toujourdHui;
              const estActif = clé === jourActif;
              const nbDemandes = rdvsCase.filter(r => r.statut === "Demandé").length;
              return (
                <button
                  key={i} type="button" onClick={() => setJourActif(jourActif === clé ? null : clé)}
                  className={`min-h-[68px] p-1.5 border-b border-r border-border/40 text-left transition-colors ${
                    estActif ? "bg-primary/10 border-primary/30" : "hover:bg-secondary/30"
                  }`}
                >
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[12px] font-medium mb-1 ${
                    estAujourd ? "bg-primary text-primary-foreground" : "text-foreground"
                  }`}>{num}</span>
                  {rdvsCase.length > 0 && (
                    <div className="flex flex-wrap gap-0.5">
                      {rdvsCase.slice(0, 3).map((r) => (
                        <span key={r.id} className={`w-2 h-2 rounded-full ${statColor(r.statut)}`} title={r.statut} />
                      ))}
                      {rdvsCase.length > 3 && <span className="text-[9px] text-muted-foreground leading-none mt-0.5">+{rdvsCase.length - 3}</span>}
                    </div>
                  )}
                  {nbDemandes > 0 && (
                    <span className="block text-[9px] font-semibold text-amber-600">{nbDemandes} à traiter</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Légende */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border flex-wrap">
            {[["Demandé", "bg-amber-400"], ["Confirmé", "bg-green-500"], ["Refusé / Annulé", "bg-red-400"], ["Honoré", "bg-blue-500"], ["Absent", "bg-gray-400"]] .map(([label, cls]) => (
              <span key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className={`w-2.5 h-2.5 rounded-full ${cls}`} />{label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Détail du jour sélectionné ── */}
        <div className="w-full lg:w-[380px]">
          {!jourActif ? (
            <div className="h-full min-h-[200px] flex items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-[12.5px] text-muted-foreground text-center px-4">Cliquez sur un jour pour voir et gérer les rendez-vous.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-semibold text-foreground">
                  {new Date(jourActif + "T00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}
                </span>
                <span className="ml-auto text-[11.5px] text-muted-foreground">{rdvJour.length} RDV</span>
              </div>
              {rdvJour.length === 0 ? (
                <p className="p-4 text-[12.5px] text-muted-foreground">Aucun rendez-vous ce jour.</p>
              ) : (
                <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                  {rdvJour.map((r) => (
                    <div key={r.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${statColor(r.statut)}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            {new Date(r.dateHeure).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · {r.type}
                            {r.specialite && <span className="font-normal text-muted-foreground"> · {r.specialite}</span>}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            {r.assure.prenom ?? ""} {r.assure.nom}
                            <span className="ml-1 text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{r.assure.matricule}</span>
                            {r.assure.telephone && <> · <Phone className="w-3 h-3 inline" /> {r.assure.telephone}</>}
                          </p>
                          {r.medecin && <p className="text-[11.5px] text-muted-foreground">Médecin : {nomMedecin(r.medecin)}</p>}
                          {r.motif && <p className="text-[11.5px] text-muted-foreground">Motif : {r.motif}</p>}
                        </div>
                        <Badge variant={r.statut === "Confirmé" ? "success" : r.statut === "Refusé" || r.statut === "Annulé" ? "danger" : r.statut === "Demandé" ? "warning" : "neutral"}>
                          {r.statut}
                        </Badge>
                      </div>
                      {/* Actions — uniquement si Demandé */}
                      {r.statut === "Demandé" && (
                        edition?.id === r.id ? (
                          <div className="pl-4 space-y-1.5">
                            {medecins.length > 0 && (
                              <select
                                value={edition.medecinId}
                                onChange={(e) => setEdition({ ...edition, medecinId: e.target.value })}
                                className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground"
                              >
                                <option value="">— Médecin à affecter —</option>
                                {medecins.map((m) => <option key={m.id} value={m.id}>{nomMedecin(m)}{m.specialite ? ` · ${m.specialite}` : ""}</option>)}
                              </select>
                            )}
                            <input
                              type="datetime-local"
                              value={edition.dateHeure}
                              onChange={(e) => setEdition({ ...edition, dateHeure: e.target.value })}
                              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground"
                            />
                            <input
                              placeholder="Message au patient (optionnel)"
                              value={edition.message}
                              onChange={(e) => setEdition({ ...edition, message: e.target.value })}
                              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground"
                            />
                            <div className="flex gap-1.5">
                              <button type="button" onClick={() => repondre(r.id, "Confirmé", { dateHeure: edition.dateHeure || undefined, medecinId: edition.medecinId || undefined, reponse: edition.message || undefined })}
                                className="flex-1 h-7 rounded-lg bg-green-600 text-white text-[11.5px] font-medium inline-flex items-center justify-center gap-1">
                                <Check className="w-3 h-3" />Confirmer
                              </button>
                              <button type="button" onClick={() => repondre(r.id, "Refusé", { reponse: edition.message || undefined })}
                                className="flex-1 h-7 rounded-lg bg-red-600 text-white text-[11.5px] font-medium inline-flex items-center justify-center gap-1">
                                <X className="w-3 h-3" />Refuser
                              </button>
                              <button type="button" onClick={() => setEdition(null)} className="h-7 px-2 rounded-lg border border-border text-[11.5px] text-muted-foreground">Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div className="pl-4">
                            <button type="button"
                              onClick={() => setEdition({ id: r.id, dateHeure: new Date(r.dateHeure).toISOString().slice(0, 16), medecinId: r.medecin?.id ?? "", message: "" })}
                              className="text-[11.5px] text-primary hover:underline">
                              Traiter ce rendez-vous
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
