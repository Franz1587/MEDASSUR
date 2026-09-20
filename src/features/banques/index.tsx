import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Landmark, History, Trophy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import {
  getBanques, createBanque, updateBanque, getMouvementsBanque, getStatistiquesBanques,
} from "@/services/banques.service";
import type { Banque, BanqueUpsertInput, MouvementBanque, StatistiqueBanque } from "@/types/banques";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyForm(): BanqueUpsertInput {
  return { nom: "", codeBanque: "", compteNumero: "", adresse: "", ville: "", telephone: "", statut: "Actif" };
}

// Banques (2026-08) — voir demande utilisateur : "toutes les banques créées
// dans le système. On pourra les modifier. on pourra également voir
// l'historique des mouvement de ses banque en fonction des paiement des
// sinistres. ça permettra de savoir la banque la plus utilisée par les
// clients dans le cadre des transaction bancaire." Une LettreCheque EST le
// règlement bancaire réel des sinistres (voir BanquesService.mouvements/
// statistiques) — pas de registre séparé.
export default function BanquesView() {
  const [banques, setBanques] = useState<Banque[]>([]);
  const [stats, setStats] = useState<StatistiqueBanque[]>([]);
  const [recherche, setRecherche] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BanqueUpsertInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);

  const [mouvementsBanque, setMouvementsBanque] = useState<Banque | null>(null);
  const [mouvements, setMouvements] = useState<MouvementBanque[]>([]);
  const [loadingMouvements, setLoadingMouvements] = useState(false);
  const paginationMouvements = usePagination(mouvements);

  const refresh = () => {
    getBanques().then(setBanques);
    getStatistiquesBanques().then(setStats);
  };
  useEffect(() => { refresh(); }, []);

  const statsById = useMemo(() => new Map(stats.map((s) => [s.banqueId, s])), [stats]);
  const classement = stats.filter((s) => s.nombreLettresCheque > 0).slice(0, 4);

  const banquesFiltrees = banques.filter((b) => {
    const q = recherche.trim().toLowerCase();
    if (!q) return true;
    return b.nom.toLowerCase().includes(q) || (b.codeBanque ?? "").toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (b: Banque) => {
    setEditId(b.id);
    setForm({ nom: b.nom, codeBanque: b.codeBanque ?? "", compteNumero: b.compteNumero ?? "", adresse: b.adresse ?? "", ville: b.ville ?? "", telephone: b.telephone ?? "", statut: b.statut });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom.trim()) {
      toast.error("Le nom de la banque est obligatoire.");
      return;
    }
    try {
      setSubmitting(true);
      if (editId) await updateBanque(editId, form);
      else await createBanque(form);
      setShowForm(false);
      refresh();
      toast.success(editId ? "Banque modifiée." : "Banque créée avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  const openMouvements = async (b: Banque) => {
    setMouvementsBanque(b);
    setMouvements([]);
    setLoadingMouvements(true);
    try {
      setMouvements(await getMouvementsBanque(b.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement de l'historique impossible.");
    } finally {
      setLoadingMouvements(false);
    }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Banques" subtitle="Établissements bancaires du système et historique de leurs mouvements" icon={Landmark}
        actions={<Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle banque</Btn>}
      />

      {classement.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Banques les plus utilisées — règlements sinistres (lettres chèque)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {classement.map((s, i) => (
              <div key={s.banqueId} className={`rounded-lg border p-3 ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {i === 0 && <Trophy className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  <span className="text-[13px] font-semibold text-foreground truncate">{s.banqueNom}</span>
                </div>
                <div className="text-[16px] font-bold text-foreground med-num">{fmtM(s.montantTotal)}</div>
                <div className="text-[11px] text-muted-foreground">{s.nombreLettresCheque} règlement{s.nombreLettresCheque > 1 ? "s" : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher une banque…" className={`${fieldCls} pl-9`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {banquesFiltrees.map((b) => {
          const s = statsById.get(b.id);
          return (
            <div key={b.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{b.nom}</p>
                  {b.codeBanque && <p className="text-[11px] text-muted-foreground med-num">Code {b.codeBanque}</p>}
                </div>
                <Badge variant={b.statut === "Actif" ? "success" : "neutral"}>{b.statut}</Badge>
              </div>
              {b.compteNumero && <p className="text-[11.5px] text-muted-foreground mt-1 med-num">Compte {b.compteNumero}</p>}
              <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-[11.5px]">
                <div>
                  <div className="text-muted-foreground">Règlements sinistres</div>
                  <div className="font-semibold text-foreground med-num">{s?.nombreLettresCheque ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Montant total</div>
                  <div className="font-semibold text-foreground med-num">{fmtM(s?.montantTotal ?? 0)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Btn variant="secondary" onClick={() => openMouvements(b)}><History className="w-3.5 h-3.5" />Mouvements</Btn>
                <Btn variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" />Modifier</Btn>
              </div>
            </div>
          );
        })}
        {banquesFiltrees.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Aucune banque enregistrée</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editId ? "Modifier la banque" : "Nouvelle banque"}</h3>
              <button type="button" onClick={() => setShowForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3.5">
              <label className="block"><div className={labelCls}>Nom de la banque</div><input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className={fieldCls} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Code banque</div><input value={form.codeBanque ?? ""} onChange={(e) => setForm((f) => ({ ...f, codeBanque: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>N° de compte</div><input value={form.compteNumero ?? ""} onChange={(e) => setForm((f) => ({ ...f, compteNumero: e.target.value }))} className={fieldCls} /></label>
              </div>
              {/* Coordonnées de l'agence (2026-09) — voir demande utilisateur
                  sur la Lettre chèque : imprimées dans l'encadré gauche du
                  visuel de chèque (DocumentsService.renderLettreCheque). */}
              <label className="block"><div className={labelCls}>Adresse de l'agence</div><input value={form.adresse ?? ""} onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))} placeholder="ex : Boulevard de l'Indépendance" className={fieldCls} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Ville</div><input value={form.ville ?? ""} onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))} placeholder="ex : Libreville" className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Téléphone de l'agence</div><input value={form.telephone ?? ""} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className={fieldCls} /></label>
              </div>
              {editId && (
                <label className="block"><div className={labelCls}>Statut</div>
                  <select value={form.statut ?? "Actif"} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))} className={fieldCls}>
                    <option>Actif</option><option>Inactif</option>
                  </select>
                </label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submitting} onClick={handleSave} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {mouvementsBanque && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2"><History className="w-4 h-4" />Mouvements — {mouvementsBanque.nom}</h3>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">Règlements de sinistres (lettres chèque) émis sur cette banque</p>
              </div>
              <button type="button" onClick={() => setMouvementsBanque(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {loadingMouvements ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Chargement…</div>
              ) : mouvements.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">Aucun mouvement enregistré sur cette banque.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-medium">Lettre chèque</th>
                        <th className="py-2 pr-3 font-medium">N° chèque</th>
                        <th className="py-2 pr-3 font-medium">Date d'émission</th>
                        <th className="py-2 pr-3 font-medium">Prestataire</th>
                        <th className="py-2 pr-3 font-medium">Compagnie</th>
                        <th className="py-2 pr-3 font-medium text-right">Montant</th>
                        <th className="py-2 font-medium">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginationMouvements.pageItems.map((m) => (
                        <tr key={m.id} className="border-b border-border/60 hover:bg-secondary/20">
                          <td className="py-2 pr-3 text-primary font-medium med-num">{m.numero}</td>
                          <td className="py-2 pr-3 med-num">{m.numeroCheque}</td>
                          <td className="py-2 pr-3">{m.dateEmission}</td>
                          <td className="py-2 pr-3 text-foreground">{m.prestataireNom}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{m.compagnieNom ?? "—"}</td>
                          <td className="py-2 pr-3 text-right font-semibold text-foreground med-num">{fmtM(m.montantTotal)}</td>
                          <td className="py-2"><Badge variant={m.statut === "Annulée" ? "danger" : "success"}>{m.statut}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    page={paginationMouvements.page} pageCount={paginationMouvements.pageCount} pageSize={paginationMouvements.pageSize}
                    pageSizeOptions={paginationMouvements.pageSizeOptions} total={paginationMouvements.total} debut={paginationMouvements.debut} fin={paginationMouvements.fin}
                    onPageChange={paginationMouvements.setPage} onPageSizeChange={paginationMouvements.setPageSize}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
