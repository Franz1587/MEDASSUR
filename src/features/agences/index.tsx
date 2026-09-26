import { useEffect, useState } from "react";
import { Plus, Search, Building2, Pencil, Trash2, MapPin, Phone, Mail, User, Tag, X, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { getAgences, createAgence, updateAgence, deleteAgence } from "@/services/agences.service";
import type { Agence, AgenceUpsertInput, StatutAgence } from "@/types/agences";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): AgenceUpsertInput {
  return { nom: "", code: "", ville: "", adresse: "", telephone: "", email: "", responsable: "", statut: "Actif", mentionsImport: [], creerDeclinaisonsAuto: true };
}

function formDe(a: Agence): AgenceUpsertInput {
  return {
    nom: a.nom, code: a.code ?? "", ville: a.ville ?? "", adresse: a.adresse ?? "", telephone: a.telephone ?? "",
    email: a.email ?? "", responsable: a.responsable ?? "", statut: a.statut, mentionsImport: [...a.mentionsImport], creerDeclinaisonsAuto: a.creerDeclinaisonsAuto,
  };
}

// Paramétrage des agences (2026-09) — voir demande utilisateur : "il faut
// rendre paramétrable la création des agences au lieu de laisser juste le
// code le décider." Tout ce qui caractérise une agence se saisit ici,
// y compris les mentions ("POG"...) qui rattachent automatiquement à
// l'agence un contrat importé dont la compagnie/le souscripteur les porte.
export default function AgencesView() {
  const [agences, setAgences] = useState<Agence[]>([]);
  const [recherche, setRecherche] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AgenceUpsertInput>(emptyForm());
  const [mentionSaisie, setMentionSaisie] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = () => getAgences().then(setAgences);
  useEffect(() => { refresh(); }, []);

  const agencesFiltrees = agences.filter((a) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return [a.nom, a.code, a.ville, a.responsable, ...a.mentionsImport].some((v) => (v ?? "").toLowerCase().includes(q));
  });
  const pagination = usePagination(agencesFiltrees);

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setMentionSaisie(""); setShowForm(true); };
  const openEdit = (a: Agence) => { setEditId(a.id); setForm(formDe(a)); setMentionSaisie(""); setShowForm(true); };
  const setChamp = (cle: keyof AgenceUpsertInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [cle]: e.target.value }));

  // Une mention se valide par Entrée ou virgule ; doublons ignorés.
  const ajouterMention = () => {
    const m = mentionSaisie.trim().replace(/,$/, "").trim();
    if (!m) return;
    setForm((f) => {
      const existantes = f.mentionsImport ?? [];
      return existantes.some((x) => x.toLowerCase() === m.toLowerCase()) ? f : { ...f, mentionsImport: [...existantes, m] };
    });
    setMentionSaisie("");
  };
  const retirerMention = (m: string) => setForm((f) => ({ ...f, mentionsImport: (f.mentionsImport ?? []).filter((x) => x !== m) }));

  const handleSave = async () => {
    if (!form.nom.trim()) { toast.error("Le nom de l'agence est obligatoire."); return; }
    // Une mention encore dans le champ (pas validée par Entrée) est
    // enregistrée aussi, plutôt que perdue en silence.
    const enAttente = mentionSaisie.trim();
    const payload = enAttente && !(form.mentionsImport ?? []).some((x) => x.toLowerCase() === enAttente.toLowerCase())
      ? { ...form, mentionsImport: [...(form.mentionsImport ?? []), enAttente] }
      : form;
    try {
      setSubmitting(true);
      if (editId) await updateAgence(editId, payload);
      else await createAgence(payload);
      setShowForm(false);
      refresh();
      toast.success(editId ? "Agence modifiée." : "Agence créée avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (a: Agence) => {
    const ok = window.confirm(`Supprimer l'agence "${a.nom}" ?`);
    if (!ok) return;
    try {
      await deleteAgence(a.id);
      refresh();
      toast.success("Agence supprimée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Agences" subtitle="Succursales de la société — paramétrez-les ici, rattachez-y vos agents et vos contrats" icon={Building2}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle agence</Btn>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une agence, une ville, une mention…" className={`${fieldCls} pl-9`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {pagination.pageItems.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">{a.nom}</p>
                {a.code && <p className="text-[11px] text-muted-foreground med-num">Code {a.code}</p>}
              </div>
              <span className={`shrink-0 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${a.statut === "Actif" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}>{a.statut}</span>
            </div>
            <div className="mt-2.5 space-y-1 text-[12px] text-muted-foreground">
              {(a.ville || a.adresse) && <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{[a.adresse, a.ville].filter(Boolean).join(", ")}</span></p>}
              {a.telephone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{a.telephone}</p>}
              {a.email && <p className="flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5 shrink-0" />{a.email}</p>}
              {a.responsable && <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" />{a.responsable}</p>}
            </div>
            {a.mentionsImport.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                {a.mentionsImport.map((m) => <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m}</span>)}
              </div>
            )}
            <div className="mt-2.5 flex items-center gap-3 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{a._count?.contrats ?? 0} contrat(s)</span>
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{a._count?.agents ?? 0} agent(s)</span>
            </div>
            <div className="mt-auto pt-3 border-t border-border/60 flex items-center gap-2">
              <Btn variant="ghost" onClick={() => openEdit(a)}><Pencil className="w-3.5 h-3.5" />Modifier</Btn>
              <Btn variant="ghost" onClick={() => handleDelete(a)}><Trash2 className="w-3.5 h-3.5" />Supprimer</Btn>
            </div>
          </div>
        ))}
        {agencesFiltrees.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Aucune agence enregistrée</div>
        )}
      </div>
      <Pagination
        page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
        pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
        onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      />

      {showForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editId ? "Modifier l'agence" : "Nouvelle agence"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 overflow-y-auto">
              <label className="block"><div className={labelCls}>Nom de l'agence *</div><input value={form.nom} onChange={setChamp("nom")} className={fieldCls} placeholder="ex : Agence de Port-Gentil" /></label>
              <label className="block"><div className={labelCls}>Code</div><input value={form.code ?? ""} onChange={setChamp("code")} className={fieldCls} placeholder="ex : POG" />
                <p className="text-[11px] text-muted-foreground mt-1">Sert aussi de suffixe aux compagnies de l'agence (ex. NSIA ASSURANCES POG).</p>
              </label>
              <label className="block"><div className={labelCls}>Ville</div><input value={form.ville ?? ""} onChange={setChamp("ville")} className={fieldCls} placeholder="ex : Port-Gentil" /></label>
              <label className="block"><div className={labelCls}>Adresse</div><input value={form.adresse ?? ""} onChange={setChamp("adresse")} className={fieldCls} placeholder="Quartier, rue, BP…" /></label>
              <label className="block"><div className={labelCls}>Téléphone</div><input value={form.telephone ?? ""} onChange={setChamp("telephone")} className={fieldCls} placeholder="+241 …" /></label>
              <label className="block"><div className={labelCls}>Email</div><input type="email" value={form.email ?? ""} onChange={setChamp("email")} className={fieldCls} placeholder="agence@exemple.ga" /></label>
              <label className="block"><div className={labelCls}>Responsable</div><input value={form.responsable ?? ""} onChange={setChamp("responsable")} className={fieldCls} placeholder="Nom du responsable d'agence" /></label>
              <label className="block"><div className={labelCls}>Statut</div>
                <select value={form.statut ?? "Actif"} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as StatutAgence }))} className={fieldCls}>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <div className={labelCls}>Mentions reconnues à l'import de contrats</div>
                <div className={`${fieldCls} flex flex-wrap items-center gap-1.5 min-h-[40px]`}>
                  {(form.mentionsImport ?? []).map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {m}
                      <button type="button" onClick={() => retirerMention(m)} aria-label={`Retirer ${m}`} className="hover:opacity-70"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  <input
                    value={mentionSaisie}
                    onChange={(e) => setMentionSaisie(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); ajouterMention(); } }}
                    onBlur={ajouterMention}
                    className="flex-1 min-w-[140px] bg-transparent outline-none text-[13px] text-foreground"
                    placeholder={(form.mentionsImport ?? []).length ? "Ajouter…" : "ex : POG, PORT-GENTIL — Entrée pour valider"}
                  />
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1.5">
                  Un contrat importé dont la compagnie ou le souscripteur contient l'une de ces mentions (ex. « OGAR ASSURANCES POG ») est rattaché automatiquement à cette agence. Une agence inactive n'est jamais retenue.
                </p>
              </div>
              <label className="sm:col-span-2 flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.creerDeclinaisonsAuto ?? true} onChange={(e) => setForm((f) => ({ ...f, creerDeclinaisonsAuto: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-primary" />
                <span>
                  <span className="block text-[13px] text-foreground">Créer automatiquement les déclinaisons de compagnies</span>
                  <span className="block text-[11.5px] text-muted-foreground mt-0.5">
                    Un contrat de cette agence placé sur une compagnie (ex. NSIA ASSURANCES) est imputé à sa déclinaison d'agence (NSIA ASSURANCES {form.code?.trim() || "<code>"}). Si elle n'a pas été déclarée dans l'écran Compagnies, elle est créée en copiant tout le paramétrage de la compagnie mère. Décoché : seules les déclinaisons déclarées sont utilisées.
                  </span>
                </span>
              </label>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submitting} onClick={handleSave} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
