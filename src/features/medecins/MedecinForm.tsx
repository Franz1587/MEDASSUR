import { useEffect, useState } from "react";
import { X, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { SPECIALITES_SANTE } from "@/lib/specialitesSante";
import { getPrestataires } from "@/services/prestataires.service";
import { createMedecin, updateMedecin, lierStructure, delierStructure, type Medecin, type MedecinUpsertInput } from "@/services/medecins.service";
import type { Prestataire } from "@/types/prestataires";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const TITRES = ["Professeur", "Docteur"] as const;

function toForm(m?: Medecin | null): MedecinUpsertInput {
  return {
    nom: m?.nom ?? "", prenom: m?.prenom ?? "", titre: m?.titre ?? "", specialite: m?.specialite ?? "",
    codePraticien: m?.codePraticien ?? "", telephone: m?.telephone ?? "", email: m?.email ?? "",
  };
}

export default function MedecinForm({ medecin, onClose, onSaved }: { medecin?: Medecin | null; onClose: () => void; onSaved: (m: Medecin) => void }) {
  const [form, setForm] = useState<MedecinUpsertInput>(toForm(medecin));
  const [structuresLiees, setStructuresLiees] = useState(medecin?.structures ?? []);
  const [structureAAjouter, setStructureAAjouter] = useState<Prestataire | null>(null);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const estEdition = !!medecin;

  useEffect(() => { getPrestataires().then(setPrestataires); }, []);

  const structuresDisponibles = prestataires.filter((p) => !structuresLiees.some((s) => s.id === p.id));

  // En édition, la liaison se fait en direct (2026-08) — le médecin existe
  // déjà en base, chaque ajout/retrait est immédiatement persisté (voir
  // MedecinsService.lierStructure/delierStructure), pas de diff à calculer
  // à l'enregistrement du formulaire.
  const ajouterStructure = async (p: Prestataire | null) => {
    if (!p || !estEdition) return;
    try {
      const maj = await lierStructure(medecin!.id, p.id);
      setStructuresLiees(maj.structures);
      setStructureAAjouter(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Liaison impossible.");
    }
  };
  const retirerStructure = async (prestataireId: string) => {
    if (!estEdition) return;
    try {
      const maj = await delierStructure(medecin!.id, prestataireId);
      setStructuresLiees(maj.structures);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrait impossible.");
    }
  };
  // À la création, les structures choisies partent avec le POST initial
  // (voir MedecinsService.create, prestataireIds).
  const toggleStructureCreation = (p: Prestataire) => {
    setStructuresLiees((v) => (v.some((s) => s.id === p.id) ? v.filter((s) => s.id !== p.id) : [...v, { id: p.id, nom: p.nom, type: p.type, ville: p.ville }]));
  };

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire."); return; }
    setSubmitting(true);
    try {
      const payload: MedecinUpsertInput = {
        ...form,
        prenom: form.prenom?.trim() || undefined,
        titre: form.titre || undefined,
        specialite: form.specialite?.trim() || undefined,
        codePraticien: form.codePraticien?.trim() || undefined,
        telephone: form.telephone?.trim() || undefined,
        email: form.email?.trim() || undefined,
      };
      const saved = estEdition
        ? await updateMedecin(medecin!.id, payload)
        : await createMedecin({ ...payload, prestataireIds: structuresLiees.map((s) => s.id) });
      toast.success(estEdition ? "Médecin mis à jour." : "Médecin créé.");
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
      <div className="w-full max-w-lg max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">{estEdition ? `Modifier ${medecin!.nom}` : "Nouveau médecin"}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className={labelCls}>Titre</div>
              <select value={form.titre ?? ""} onChange={(e) => setForm((v) => ({ ...v, titre: e.target.value }))} className={fieldCls}>
                <option value="">Non renseigné</option>
                {TITRES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <div className={labelCls}>Code praticien (N° à l'ordre des médecins)</div>
              <input value={form.codePraticien ?? ""} onChange={(e) => setForm((v) => ({ ...v, codePraticien: e.target.value }))} className={fieldCls} />
            </label>
            <label className="block"><div className={labelCls}>Nom *</div><input value={form.nom} onChange={(e) => setForm((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Prénom</div><input value={form.prenom ?? ""} onChange={(e) => setForm((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
            <label className="block md:col-span-2">
              <div className={labelCls}>Spécialité</div>
              <Combobox
                options={SPECIALITES_SANTE}
                value={form.specialite || null}
                onChange={(s) => setForm((v) => ({ ...v, specialite: s ?? "" }))}
                getLabel={(s) => s} getId={(s) => s}
                allowClear clearLabel="Non renseignée"
                placeholder="Rechercher…"
              />
            </label>
            <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone ?? ""} onChange={(e) => setForm((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
            <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.email ?? ""} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} className={fieldCls} /></label>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-primary uppercase tracking-wide mb-2">Structures où il intervient</p>
            {estEdition ? (
              <Combobox
                options={structuresDisponibles}
                value={structureAAjouter}
                onChange={ajouterStructure}
                getLabel={(p) => p.nom} getSubLabel={(p) => `${p.type} · ${p.ville}`} getId={(p) => p.id}
                placeholder="Rechercher un hôpital/clinique/cabinet à ajouter…"
              />
            ) : (
              <Combobox
                options={structuresDisponibles}
                value={null}
                onChange={(p) => p && toggleStructureCreation(p)}
                getLabel={(p) => p.nom} getSubLabel={(p) => `${p.type} · ${p.ville}`} getId={(p) => p.id}
                placeholder="Rechercher un hôpital/clinique/cabinet à ajouter…"
              />
            )}
            {structuresLiees.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {structuresLiees.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/25">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 min-w-0 text-[12.5px] text-foreground truncate">{s.nom}</span>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{s.type} · {s.ville}</span>
                    <button
                      type="button"
                      onClick={() => (estEdition ? retirerStructure(s.id) : setStructuresLiees((v) => v.filter((x) => x.id !== s.id)))}
                      className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
