import { useEffect, useState } from "react";
import { X, Landmark, Plus, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { getBanques, createBanque, ajouterLotCheques } from "@/services/banques.service";
import type { Banque } from "@/types/banques";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyBanqueForm() {
  return { nom: "", codeBanque: "", compteNumero: "" };
}

// Taille de lot habituelle remise par les banques (voir demande
// utilisateur) — au-delà, l'application ne bloque pas la saisie (une
// banque peut très bien remettre un chéquier plus grand) mais le signale.
const TAILLE_LOT_STANDARD = 50;
// Seuil d'alerte sur le nombre de chèques restants — vert au-dessus,
// rouge à partir de 10 restants ou moins (voir demande utilisateur).
const SEUIL_ALERTE_RESTANTS = 10;
function couleurRestants(restants: number): string {
  return restants <= SEUIL_ALERTE_RESTANTS ? "text-red-500" : "text-green-500";
}

interface LotForm {
  numeroDebut: string;
  numeroFin: string;
}

export default function GestionBanquesModal({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [banques, setBanques] = useState<Banque[]>([]);
  const [formBanque, setFormBanque] = useState(emptyBanqueForm());
  const [creantBanque, setCreantBanque] = useState(false);
  // Un formulaire d'ajout de lot par banque, toujours visible (pas de
  // panneau à déplier) — chaque banque garde sa propre saisie en cours.
  const [formsLot, setFormsLot] = useState<Record<string, LotForm>>({});
  const [creantLotPour, setCreantLotPour] = useState<string | null>(null);

  const refresh = () => getBanques().then(setBanques);
  useEffect(() => { refresh(); }, []);

  const lotForm = (banqueId: string): LotForm => formsLot[banqueId] ?? { numeroDebut: "", numeroFin: "" };
  const setLotForm = (banqueId: string, patch: Partial<LotForm>) =>
    setFormsLot((v) => ({ ...v, [banqueId]: { ...lotForm(banqueId), ...patch } }));

  const handleCreerBanque = async () => {
    if (!formBanque.nom.trim()) { toast.error("Le nom de la banque est obligatoire."); return; }
    setCreantBanque(true);
    try {
      await createBanque({
        nom: formBanque.nom.trim(),
        codeBanque: formBanque.codeBanque.trim() || undefined,
        compteNumero: formBanque.compteNumero.trim() || undefined,
      });
      toast.success("Banque ajoutée.");
      setFormBanque(emptyBanqueForm());
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setCreantBanque(false);
    }
  };

  const handleAjouterLot = async (banqueId: string) => {
    const { numeroDebut, numeroFin } = lotForm(banqueId);
    const debut = Number(numeroDebut);
    const fin = Number(numeroFin);
    if (!numeroDebut.trim() || !numeroFin.trim() || !Number.isFinite(debut) || !Number.isFinite(fin) || debut <= 0 || fin <= 0) {
      toast.error("Renseignez le numéro de chèque de départ et le dernier numéro.");
      return;
    }
    if (fin < debut) { toast.error("Le dernier numéro doit être supérieur ou égal au numéro de départ."); return; }
    setCreantLotPour(banqueId);
    try {
      await ajouterLotCheques(banqueId, { numeroDebut: debut, numeroFin: fin });
      toast.success(`Lot de ${fin - debut + 1} chèque(s) ajouté.`);
      setFormsLot((v) => ({ ...v, [banqueId]: { numeroDebut: "", numeroFin: "" } }));
      refresh();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ajout du lot impossible.");
    } finally {
      setCreantLotPour(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><Landmark className="w-4 h-4 text-primary" />Banques et séries de chèques</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-[12px] font-semibold text-foreground">Ajouter une banque</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="block">
                <div className={labelCls}>Nom *</div>
                <input value={formBanque.nom} onChange={(e) => setFormBanque((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} placeholder="ex. BGFI Bank" />
              </label>
              <label className="block">
                <div className={labelCls}>Code banque</div>
                <input value={formBanque.codeBanque} onChange={(e) => setFormBanque((v) => ({ ...v, codeBanque: e.target.value }))} className={fieldCls} />
              </label>
              <label className="block">
                <div className={labelCls}>N° de compte</div>
                <input value={formBanque.compteNumero} onChange={(e) => setFormBanque((v) => ({ ...v, compteNumero: e.target.value }))} className={fieldCls} />
              </label>
            </div>
            <Btn variant="primary" onClick={handleCreerBanque} disabled={creantBanque}><Plus className="w-4 h-4" />{creantBanque ? "Ajout…" : "Ajouter la banque"}</Btn>
          </div>

          <div className="space-y-3">
            {banques.map((b) => {
              const lotActif = b.lots.find((l) => l.statut === "Actif");
              const form = lotForm(b.id);
              const debutSaisi = Number(form.numeroDebut);
              const finSaisi = Number(form.numeroFin);
              const nombreSaisi = form.numeroDebut.trim() && form.numeroFin.trim() && Number.isFinite(debutSaisi) && Number.isFinite(finSaisi) && finSaisi >= debutSaisi
                ? finSaisi - debutSaisi + 1
                : null;
              return (
                <div key={b.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="px-4 py-3 bg-secondary/20">
                    <p className="text-[13px] font-semibold text-foreground">{b.nom}{b.codeBanque ? ` — ${b.codeBanque}` : ""}</p>
                    {b.compteNumero && <p className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{b.compteNumero}</p>}
                  </div>

                  {/* Formulaire d'ajout de lot toujours visible — pas de panneau à
                      déplier — pour que le paramétrage d'une nouvelle série de
                      chèques soit immédiatement accessible sur chaque banque. */}
                  <div className="px-4 py-3 border-t border-border bg-secondary/10 space-y-2">
                    <div className="flex items-end gap-3 flex-wrap">
                      <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0 mb-2" />
                      <label className="block">
                        <div className={labelCls}>Numéro de chèque de départ</div>
                        <input type="number" min={1} value={form.numeroDebut} onChange={(e) => setLotForm(b.id, { numeroDebut: e.target.value })} className={fieldCls} placeholder="ex. 1000" />
                      </label>
                      <label className="block">
                        <div className={labelCls}>Dernier numéro de chèque</div>
                        <input type="number" min={1} value={form.numeroFin} onChange={(e) => setLotForm(b.id, { numeroFin: e.target.value })} className={fieldCls} placeholder="ex. 1049" />
                      </label>
                      <Btn variant="primary" onClick={() => handleAjouterLot(b.id)} disabled={creantLotPour === b.id}>
                        <Plus className="w-4 h-4" />{creantLotPour === b.id ? "Ajout…" : "Ajouter le lot"}
                      </Btn>
                    </div>
                    {/* Compte en direct le nombre de chèques saisis, et signale
                        (sans bloquer) si le lot dépasse la taille standard de 50
                        remise par les banques — voir demande utilisateur. */}
                    {nombreSaisi !== null && (
                      nombreSaisi > TAILLE_LOT_STANDARD ? (
                        <p className="text-[11px] text-amber-500 flex items-center gap-1.5 pl-6">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          Ce lot compte <span className="font-semibold">{nombreSaisi} chèques</span> — au-delà du lot standard de {TAILLE_LOT_STANDARD}. Vérifiez la série avant de valider.
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground pl-6">
                          Ce lot compte <span className="font-semibold text-foreground">{nombreSaisi} chèque{nombreSaisi > 1 ? "s" : ""}</span>{nombreSaisi === TAILLE_LOT_STANDARD ? " — un lot standard." : "."}
                        </p>
                      )
                    )}
                  </div>

                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-border/60 bg-secondary/10">
                        {["Série", "Nb. chèques", "Prochain N°", "Restants", "Statut"].map((h) => (
                          <th key={h} className="text-left text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-3 py-1.5 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {b.lots.map((l) => {
                        const total = l.numeroFin - l.numeroDebut + 1;
                        const restants = l.statut === "Épuisé" ? 0 : l.numeroFin - l.numeroProchain + 1;
                        return (
                          <tr key={l.id} className="border-b border-border/40 last:border-0">
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.numeroDebut} — {l.numeroFin}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                              {total}{total > TAILLE_LOT_STANDARD && <AlertTriangle className="w-3 h-3 text-amber-500 inline-block ml-1 mb-0.5" />}
                            </td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.statut === "Épuisé" ? "—" : l.numeroProchain}</td>
                            <td className={`px-3 py-1.5 whitespace-nowrap font-semibold ${couleurRestants(restants)}`} style={{ fontFamily: "'DM Mono', monospace" }}>{restants}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap"><Badge variant={l.statut === "Actif" ? "success" : "neutral"}>{l.statut}</Badge></td>
                          </tr>
                        );
                      })}
                      {b.lots.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-3 text-center text-muted-foreground">{!lotActif && "Aucune série de chèques — renseignez-en une ci-dessus pour pouvoir générer des lettres chèque sur cette banque."}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {banques.length === 0 && <p className="text-center text-muted-foreground text-sm py-6">Aucune banque paramétrée.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
