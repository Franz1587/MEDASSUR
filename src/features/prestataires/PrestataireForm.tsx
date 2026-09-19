import { useState } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { SPECIALITES_SANTE } from "@/lib/specialitesSante";
import { GROUPES_ACTES, CATEGORIES_GARANTIES } from "@/features/portail-prestataire/prestationTypes";
import { createPrestataire, updatePrestataire, geolocaliserPrestataire, type PrestataireUpsertInput } from "@/services/prestataires.service";
import type { Prestataire } from "@/types/prestataires";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

// "Médecin" retiré (2026-08) — voir demande utilisateur : "créer un onglet
// professionnel de santé... c'est ici que l'on pourra créer des médecins,
// puis les lier à une clinique, hôpital" (voir src/features/medecins),
// distinct des structures gérées dans cet écran.
const TYPES = ["Hôpital", "Clinique", "Cabinet", "Centre de Kinésithérapie", "Opticien", "Pharmacie", "Laboratoire", "Dépôt pharmaceutique", "Centre d'Imagerie", "Cabinet Dentaire"];
const STATUTS = ["En négociation", "Conventionné", "Suspendu"];

// Suggestions par type de prestataire (2026-08) — voir demande utilisateur :
// "on doit pouvoir définir les garanties... en fonction du type de
// prestataire... une pharmacie, un laboratoire n'aura pas besoin de
// consultation". Simple point de départ suggéré via le bouton "Pré-remplir
// pour ce type" ci-dessous — reste entièrement modifiable ensuite (case par
// case), jamais appliqué automatiquement pour ne pas écraser une
// configuration déjà personnalisée.
const SUGGESTIONS_PAR_TYPE: Record<string, { garanties: string[]; actes: string[] }> = {
  Pharmacie: { garanties: [], actes: ["Autre"] },
  Laboratoire: { garanties: [], actes: ["Analyse"] },
};

function toForm(p?: Prestataire | null): PrestataireUpsertInput {
  return {
    nom: p?.nom ?? "", type: p?.type ?? TYPES[0], secteur: p?.secteur ?? undefined, specialite: p?.specialite ?? "",
    pays: p?.pays ?? "Gabon", ville: p?.ville ?? "", telephone: p?.telephone ?? "", adresse: p?.adresse ?? "",
    statutConvention: p?.statutConvention ?? "En négociation", dateConventionnement: p?.dateConventionnement ?? "",
    tpsAssujetti: p?.tpsAssujetti ?? false, tpsDateEffet: p?.tpsDateEffet ?? "", tpsDateArret: p?.tpsDateArret ?? "",
    garantiesVisibles: p?.garantiesVisibles ?? [], categoriesActesVisibles: p?.categoriesActesVisibles ?? [],
  };
}

export default function PrestataireForm({ prestataire, onClose, onSaved }: { prestataire?: Prestataire | null; onClose: () => void; onSaved: (p: Prestataire) => void }) {
  const [form, setForm] = useState<PrestataireUpsertInput>(toForm(prestataire));
  const [submitting, setSubmitting] = useState(false);
  // "Autre" révèle un texte libre — actif d'entrée si la spécialité déjà
  // enregistrée n'est pas dans la liste de suggestions.
  const [specialiteAutre, setSpecialiteAutre] = useState(
    form.specialite && !SPECIALITES_SANTE.includes(form.specialite) ? true : false,
  );
  const estEdition = !!prestataire;

  const [localisation, setLocalisation] = useState(prestataire);
  const [geolocalisation, setGeolocalisation] = useState(false);

  const handleGeolocaliser = async () => {
    if (!prestataire) return;
    try {
      setGeolocalisation(true);
      const maj = await geolocaliserPrestataire(prestataire.id);
      setLocalisation(maj);
      toast.success("Coordonnées géographiques mises à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Géolocalisation impossible.");
    } finally {
      setGeolocalisation(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.nom.trim() || !form.pays.trim() || !form.ville.trim()) {
      toast.error("Nom, pays et ville sont obligatoires.");
      return;
    }
    // Secteur obligatoire (2026-08) — voir demande utilisateur : "le taux
    // de couverture qui ne remonte pas pour certain assuré". Root cause :
    // sans secteur, SanteService.tauxParSecteur ne peut déterminer aucun
    // taux et laisse la ligne vide (voir sante.service.ts) — rendu
    // obligatoire ici pour empêcher la récurrence.
    if (!form.secteur) {
      toast.error("Le secteur (Public/Privé) est obligatoire — il détermine le taux de remboursement appliqué.");
      return;
    }
    if (form.tpsAssujetti && !form.tpsDateEffet?.trim()) {
      toast.error("La date d'effet de la TPS est obligatoire si le prestataire y est assujetti.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: PrestataireUpsertInput = {
        ...form,
        specialite: form.specialite?.trim() || undefined,
        telephone: form.telephone?.trim() || undefined,
        adresse: form.adresse?.trim() || undefined,
        dateConventionnement: form.dateConventionnement?.trim() || undefined,
        tpsDateEffet: form.tpsAssujetti ? form.tpsDateEffet?.trim() || undefined : undefined,
        tpsDateArret: form.tpsAssujetti ? form.tpsDateArret?.trim() || undefined : undefined,
      };
      const saved = estEdition ? await updatePrestataire(prestataire!.id, payload) : await createPrestataire(payload);
      toast.success(estEdition ? "Prestataire mis à jour." : "Prestataire créé.");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">{estEdition ? `Modifier ${prestataire!.nom}` : "Nouveau prestataire"}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div>
            <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-3">Identité</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block md:col-span-2"><div className={labelCls}>Nom *</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
              <label className="block">
                <div className={labelCls}>Type *</div>
                <select value={form.type} onChange={(e) => setForm((v) => ({ ...v, type: e.target.value }))} className={fieldCls}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <div className={labelCls}>Secteur *</div>
                <select value={form.secteur ?? ""} onChange={(e) => setForm((v) => ({ ...v, secteur: e.target.value ? (e.target.value as "Public" | "Privé") : undefined }))} className={fieldCls}>
                  <option value="">Choisir…</option>
                  <option value="Public">Public</option>
                  <option value="Privé">Privé</option>
                </select>
                <p className="text-[10.5px] text-muted-foreground mt-1">Détermine le taux de remboursement appliqué (Contrat.tauxAmbulatoire/HospitalisationPublique/Privee).</p>
              </label>
              <label className="block md:col-span-2">
                <div className={labelCls}>Spécialité</div>
                {specialiteAutre ? (
                  <div className="flex items-center gap-2">
                    <input value={form.specialite ?? ""} onChange={(e) => setForm((v) => ({ ...v, specialite: e.target.value }))} className={fieldCls} placeholder="Préciser la spécialité…" autoFocus />
                    <button type="button" onClick={() => { setSpecialiteAutre(false); setForm((v) => ({ ...v, specialite: "" })); }} className="text-[12px] text-muted-foreground hover:text-foreground whitespace-nowrap">Choisir dans la liste</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Combobox
                        options={SPECIALITES_SANTE}
                        value={form.specialite || null}
                        onChange={(s) => setForm((v) => ({ ...v, specialite: s ?? "" }))}
                        getLabel={(s) => s} getId={(s) => s}
                        allowClear clearLabel="Non renseignée"
                        placeholder="Rechercher…"
                      />
                    </div>
                    <button type="button" onClick={() => { setSpecialiteAutre(true); setForm((v) => ({ ...v, specialite: "" })); }} className="text-[12px] text-muted-foreground hover:text-foreground whitespace-nowrap flex-shrink-0">Autre…</button>
                  </div>
                )}
              </label>
              <label className="block"><div className={labelCls}>Pays *</div><input value={form.pays} onChange={(e) => setForm((v) => ({ ...v, pays: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Ville *</div><input value={form.ville} onChange={(e) => setForm((v) => ({ ...v, ville: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone ?? ""} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>Adresse</div><input value={form.adresse ?? ""} onChange={(e) => setForm((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
            </div>
          </div>

          {estEdition && (
            <div>
              <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-3">Localisation (Réseau de soins)</p>
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-secondary/20">
                <div className="flex items-center gap-2 text-[12.5px]">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {localisation?.latitude != null && localisation?.longitude != null ? (
                    <span className="text-foreground">Coordonnées enregistrées ({localisation.latitude.toFixed(5)}, {localisation.longitude.toFixed(5)})</span>
                  ) : (
                    <span className="text-muted-foreground">Aucune coordonnée — géolocalisation à partir de l'adresse/ville saisie.</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={geolocalisation}
                  onClick={handleGeolocaliser}
                  className="h-8 px-3 rounded-lg border border-border text-[12px] text-primary hover:bg-primary/10 disabled:opacity-50 inline-flex items-center gap-1.5 flex-shrink-0"
                >
                  {geolocalisation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  Localiser
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-3">Conventionnement</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className={labelCls}>Statut *</div>
                <select value={form.statutConvention} onChange={(e) => setForm((v) => ({ ...v, statutConvention: e.target.value }))} className={fieldCls}>
                  {STATUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <div className={labelCls}>Date de conventionnement</div>
                <DateInput value={form.dateConventionnement ?? ""} onChange={(v) => setForm((f) => ({ ...f, dateConventionnement: v }))} className={fieldCls} />
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-primary uppercase tracking-wide">Visibilité du portail prestataire</p>
              {SUGGESTIONS_PAR_TYPE[form.type] && (
                <button
                  type="button"
                  onClick={() => {
                    const s = SUGGESTIONS_PAR_TYPE[form.type];
                    setForm((v) => ({ ...v, garantiesVisibles: s.garanties, categoriesActesVisibles: s.actes }));
                  }}
                  className="text-[11.5px] text-primary hover:underline"
                >
                  Pré-remplir pour {form.type}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">Aucune case cochée = aucune restriction (le prestataire voit tout, comportement historique). Cocher restreint la « Liste des règles de prise en charge » et les boutons « Nouvelle prestation » côté portail prestataire — voir demande utilisateur : "une pharmacie, un laboratoire n'aura pas besoin de consultation".</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className={labelCls}>Catégories de garanties visibles</div>
                <div className="space-y-1">
                  {CATEGORIES_GARANTIES.map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer text-[12.5px] text-foreground">
                      <input
                        type="checkbox" checked={(form.garantiesVisibles ?? []).includes(c)} className="w-3.5 h-3.5 accent-primary"
                        onChange={(e) => setForm((v) => ({ ...v, garantiesVisibles: e.target.checked ? [...(v.garantiesVisibles ?? []), c] : (v.garantiesVisibles ?? []).filter((x) => x !== c) }))}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className={labelCls}>Groupes d'actes proposés en "Nouvelle prestation"</div>
                <div className="space-y-1">
                  {GROUPES_ACTES.map((g) => (
                    <label key={g.cle} className="flex items-center gap-2 cursor-pointer text-[12.5px] text-foreground">
                      <input
                        type="checkbox" checked={(form.categoriesActesVisibles ?? []).includes(g.cle)} className="w-3.5 h-3.5 accent-primary"
                        onChange={(e) => setForm((v) => ({ ...v, categoriesActesVisibles: e.target.checked ? [...(v.categoriesActesVisibles ?? []), g.cle] : (v.categoriesActesVisibles ?? []).filter((x) => x !== g.cle) }))}
                      />
                      {g.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-3">TPS</p>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={form.tpsAssujetti ?? false} onChange={(e) => setForm((v) => ({ ...v, tpsAssujetti: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-[13px] text-foreground">Prestataire assujetti à la TPS (9,5% de la base de remboursement, sauf chambre/hébergement et médicaments)</span>
            </label>
            {form.tpsAssujetti && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                <label className="block">
                  <div className={labelCls}>Date d'effet *</div>
                  <DateInput value={form.tpsDateEffet ?? ""} onChange={(v) => setForm((f) => ({ ...f, tpsDateEffet: v }))} className={fieldCls} />
                </label>
                <label className="block">
                  <div className={labelCls}>Date d'arrêt (optionnel)</div>
                  <DateInput value={form.tpsDateArret ?? ""} onChange={(v) => setForm((f) => ({ ...f, tpsDateArret: v }))} className={fieldCls} />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 flex-shrink-0">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
          <button type="button" disabled={submitting} onClick={handleSubmit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">
            {submitting ? "Enregistrement…" : estEdition ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}
