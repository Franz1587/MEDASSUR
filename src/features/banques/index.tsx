import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Landmark, History, Trophy, Pencil, ChevronDown, ChevronRight, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import {
  getBanques, createBanque, updateBanque, getMouvementsBanque, getStatistiquesBanques,
  ajouterLotCheques, ajouterCompteReglement, updateCompteReglement,
} from "@/services/banques.service";
import type { Banque, BanqueUpsertInput, CompteReglement, MouvementBanque, StatistiqueBanque } from "@/types/banques";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

function emptyBanqueForm(): BanqueUpsertInput {
  return { nom: "", codeBanque: "", compteNumero: "", adresse: "", ville: "", telephone: "", statut: "Actif" };
}

// Banques (2026-08) + comptes de règlement (2026-10) — voir demande
// utilisateur : "plusieurs comptes pour payer les sinistres sur une même
// banque, ex. Orabank Sanlam, Orabank NSIA, renseigner la plage de chèque
// à utiliser". Un CompteReglement est un sous-compte d'une Banque, avec
// ses propres LotCheques.
export default function BanquesView() {
  const [banques, setBanques] = useState<Banque[]>([]);
  const [stats, setStats] = useState<StatistiqueBanque[]>([]);
  const [recherche, setRecherche] = useState("");
  const [expandedBanques, setExpandedBanques] = useState<Set<string>>(new Set());

  // Formulaire banque
  const [showBanqueForm, setShowBanqueForm] = useState(false);
  const [editBanqueId, setEditBanqueId] = useState<string | null>(null);
  const [banqueForm, setBanqueForm] = useState<BanqueUpsertInput>(emptyBanqueForm());
  const [submittingBanque, setSubmittingBanque] = useState(false);

  // Formulaire compte de règlement
  const [showCompteForm, setShowCompteForm] = useState(false);
  const [compteFormBanqueId, setCompteFormBanqueId] = useState<string | null>(null);
  const [editCompteId, setEditCompteId] = useState<string | null>(null);
  const [compteForm, setCompteForm] = useState({ libelle: "", compteNumero: "", statut: "Actif" });
  const [submittingCompte, setSubmittingCompte] = useState(false);

  // Formulaire lot de chèques
  const [showLotForm, setShowLotForm] = useState(false);
  const [lotFormBanqueId, setLotFormBanqueId] = useState<string | null>(null);
  const [lotFormCompteId, setLotFormCompteId] = useState<string | null>(null);
  const [lotForm, setLotForm] = useState({ numeroDebut: "", numeroFin: "" });
  const [submittingLot, setSubmittingLot] = useState(false);

  // Mouvements
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

  const toggleExpand = (id: string) => {
    setExpandedBanques((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Banque ────────────────────────────────────────────────────────────

  const openCreateBanque = () => {
    setEditBanqueId(null);
    setBanqueForm(emptyBanqueForm());
    setShowBanqueForm(true);
  };

  const openEditBanque = (b: Banque) => {
    setEditBanqueId(b.id);
    setBanqueForm({ nom: b.nom, codeBanque: b.codeBanque ?? "", compteNumero: b.compteNumero ?? "", adresse: b.adresse ?? "", ville: b.ville ?? "", telephone: b.telephone ?? "", statut: b.statut });
    setShowBanqueForm(true);
  };

  const handleSaveBanque = async () => {
    if (!banqueForm.nom.trim()) { toast.error("Le nom de la banque est obligatoire."); return; }
    try {
      setSubmittingBanque(true);
      if (editBanqueId) await updateBanque(editBanqueId, banqueForm);
      else await createBanque(banqueForm);
      setShowBanqueForm(false);
      refresh();
      toast.success(editBanqueId ? "Banque modifiée." : "Banque créée avec succès.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally { setSubmittingBanque(false); }
  };

  // ── Compte de règlement ───────────────────────────────────────────────

  const openCreateCompte = (banqueId: string) => {
    setCompteFormBanqueId(banqueId);
    setEditCompteId(null);
    setCompteForm({ libelle: "", compteNumero: "", statut: "Actif" });
    setShowCompteForm(true);
  };

  const openEditCompte = (banqueId: string, c: CompteReglement) => {
    setCompteFormBanqueId(banqueId);
    setEditCompteId(c.id);
    setCompteForm({ libelle: c.libelle, compteNumero: c.compteNumero ?? "", statut: c.statut });
    setShowCompteForm(true);
  };

  const handleSaveCompte = async () => {
    if (!compteForm.libelle.trim()) { toast.error("Le libellé du compte est obligatoire."); return; }
    if (!compteFormBanqueId) return;
    try {
      setSubmittingCompte(true);
      if (editCompteId) {
        await updateCompteReglement(editCompteId, { libelle: compteForm.libelle, compteNumero: compteForm.compteNumero || undefined, statut: compteForm.statut });
      } else {
        await ajouterCompteReglement({ banqueId: compteFormBanqueId, libelle: compteForm.libelle, compteNumero: compteForm.compteNumero || undefined });
      }
      setShowCompteForm(false);
      refresh();
      toast.success(editCompteId ? "Compte modifié." : "Compte créé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally { setSubmittingCompte(false); }
  };

  // ── Lot de chèques ───────────────────────────────────────────────────

  const openLotForm = (banqueId: string, compteReglementId?: string) => {
    setLotFormBanqueId(banqueId);
    setLotFormCompteId(compteReglementId ?? null);
    setLotForm({ numeroDebut: "", numeroFin: "" });
    setShowLotForm(true);
  };

  const handleSaveLot = async () => {
    const debut = parseInt(lotForm.numeroDebut, 10);
    const fin = parseInt(lotForm.numeroFin, 10);
    if (!lotFormBanqueId || isNaN(debut) || isNaN(fin)) { toast.error("Numéros de chèques invalides."); return; }
    try {
      setSubmittingLot(true);
      await ajouterLotCheques(lotFormBanqueId, {
        numeroDebut: debut, numeroFin: fin,
        compteReglementId: lotFormCompteId ?? undefined,
      });
      setShowLotForm(false);
      refresh();
      toast.success("Plage de chèques ajoutée.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally { setSubmittingLot(false); }
  };

  // ── Mouvements ───────────────────────────────────────────────────────

  const openMouvements = async (b: Banque) => {
    setMouvementsBanque(b);
    setMouvements([]);
    setLoadingMouvements(true);
    try {
      setMouvements(await getMouvementsBanque(b.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement de l'historique impossible.");
    } finally { setLoadingMouvements(false); }
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Banques" subtitle="Établissements bancaires, comptes de règlement et plages de chèques" icon={Landmark}
        actions={<Btn variant="primary" onClick={openCreateBanque}><Plus className="w-4 h-4" />Nouvelle banque</Btn>}
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

      <div className="space-y-3">
        {banquesFiltrees.map((b) => {
          const s = statsById.get(b.id);
          const expanded = expandedBanques.has(b.id);
          const nbLotsSansCpte = b.lots.filter((l) => !l.compteReglementId).length;
          return (
            <div key={b.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
              {/* En-tête banque */}
              <div className="p-4 flex items-start gap-3">
                <button type="button" onClick={() => toggleExpand(b.id)} className="mt-0.5 text-muted-foreground hover:text-foreground flex-shrink-0">
                  {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{b.nom}</p>
                      {b.codeBanque && <p className="text-[11px] text-muted-foreground med-num">Code {b.codeBanque}</p>}
                    </div>
                    <Badge variant={b.statut === "Actif" ? "success" : "neutral"}>{b.statut}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[11.5px] text-muted-foreground flex-wrap">
                    {b.compteNumero && <span className="med-num">Compte principal : {b.compteNumero}</span>}
                    <span>{b.compteReglements.length} compte{b.compteReglements.length !== 1 ? "s" : ""} de règlement</span>
                    <span className="med-num">{s?.nombreLettresCheque ?? 0} règlement{(s?.nombreLettresCheque ?? 0) > 1 ? "s" : ""} · {fmtM(s?.montantTotal ?? 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Btn variant="secondary" onClick={() => openMouvements(b)}><History className="w-3.5 h-3.5" />Mouvements</Btn>
                  <Btn variant="ghost" onClick={() => openEditBanque(b)}><Pencil className="w-3.5 h-3.5" /></Btn>
                </div>
              </div>

              {/* Section dépliée : comptes + lots directs */}
              {expanded && (
                <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
                  {/* Lots directs sur la banque (sans compte) */}
                  {(nbLotsSansCpte > 0 || b.compteReglements.length === 0) && (
                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Plages de chèques (compte principal)</span>
                        <Btn variant="ghost" onClick={() => openLotForm(b.id)}><Plus className="w-3.5 h-3.5" />Nouvelle plage</Btn>
                      </div>
                      {b.lots.filter((l) => !l.compteReglementId).length === 0 ? (
                        <p className="text-[12px] text-muted-foreground">Aucune plage configurée</p>
                      ) : (
                        <div className="space-y-1.5">
                          {b.lots.filter((l) => !l.compteReglementId).map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between text-[12px]">
                              <span className="med-num text-foreground">{lot.numeroDebut} → {lot.numeroFin}</span>
                              <span className="text-muted-foreground med-num">Prochain : {lot.numeroProchain}</span>
                              <Badge variant={lot.statut === "Actif" ? "success" : "neutral"}>{lot.statut}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comptes de règlement */}
                  {b.compteReglements.map((c) => (
                    <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <span className="text-[13px] font-semibold text-foreground">{c.libelle}</span>
                          {c.compteNumero && <span className="text-[11px] text-muted-foreground med-num">{c.compteNumero}</span>}
                          <Badge variant={c.statut === "Actif" ? "success" : "neutral"}>{c.statut}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Btn variant="ghost" onClick={() => openLotForm(b.id, c.id)}><Plus className="w-3.5 h-3.5" />Plage</Btn>
                          <Btn variant="ghost" onClick={() => openEditCompte(b.id, c)}><Pencil className="w-3.5 h-3.5" /></Btn>
                        </div>
                      </div>
                      {c.lots.length === 0 ? (
                        <p className="text-[12px] text-muted-foreground">Aucune plage de chèques configurée</p>
                      ) : (
                        <div className="space-y-1.5">
                          {c.lots.map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between text-[12px]">
                              <span className="med-num text-foreground">{lot.numeroDebut} → {lot.numeroFin}</span>
                              <span className="text-muted-foreground med-num">Prochain : {lot.numeroProchain}</span>
                              <Badge variant={lot.statut === "Actif" ? "success" : "neutral"}>{lot.statut}</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <Btn variant="secondary" onClick={() => openCreateCompte(b.id)}>
                    <Plus className="w-3.5 h-3.5" />Nouveau compte de règlement
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
        {banquesFiltrees.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Aucune banque enregistrée</div>
        )}
      </div>

      {/* Modal banque */}
      {showBanqueForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editBanqueId ? "Modifier la banque" : "Nouvelle banque"}</h3>
              <button type="button" onClick={() => setShowBanqueForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3.5">
              <label className="block"><div className={labelCls}>Nom de la banque</div><input value={banqueForm.nom} onChange={(e) => setBanqueForm((f) => ({ ...f, nom: e.target.value }))} className={fieldCls} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Code banque</div><input value={banqueForm.codeBanque ?? ""} onChange={(e) => setBanqueForm((f) => ({ ...f, codeBanque: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>N° de compte principal</div><input value={banqueForm.compteNumero ?? ""} onChange={(e) => setBanqueForm((f) => ({ ...f, compteNumero: e.target.value }))} className={fieldCls} /></label>
              </div>
              <label className="block"><div className={labelCls}>Adresse de l'agence</div><input value={banqueForm.adresse ?? ""} onChange={(e) => setBanqueForm((f) => ({ ...f, adresse: e.target.value }))} placeholder="ex : Boulevard de l'Indépendance" className={fieldCls} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Ville</div><input value={banqueForm.ville ?? ""} onChange={(e) => setBanqueForm((f) => ({ ...f, ville: e.target.value }))} placeholder="ex : Libreville" className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Téléphone de l'agence</div><input value={banqueForm.telephone ?? ""} onChange={(e) => setBanqueForm((f) => ({ ...f, telephone: e.target.value }))} className={fieldCls} /></label>
              </div>
              {editBanqueId && (
                <label className="block"><div className={labelCls}>Statut</div>
                  <select value={banqueForm.statut ?? "Actif"} onChange={(e) => setBanqueForm((f) => ({ ...f, statut: e.target.value }))} className={fieldCls}>
                    <option>Actif</option><option>Inactif</option>
                  </select>
                </label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowBanqueForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submittingBanque} onClick={handleSaveBanque} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal compte de règlement */}
      {showCompteForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">{editCompteId ? "Modifier le compte" : "Nouveau compte de règlement"}</h3>
              <button type="button" onClick={() => setShowCompteForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3.5">
              <p className="text-[12px] text-muted-foreground">Exemple : « Sanlam » pour le compte Orabank dédié aux règlements Sanlam</p>
              <label className="block"><div className={labelCls}>Libellé du compte</div><input value={compteForm.libelle} onChange={(e) => setCompteForm((f) => ({ ...f, libelle: e.target.value }))} placeholder="ex : Sanlam, NSIA, BGFI Assurances…" className={fieldCls} /></label>
              <label className="block"><div className={labelCls}>N° de compte (optionnel)</div><input value={compteForm.compteNumero} onChange={(e) => setCompteForm((f) => ({ ...f, compteNumero: e.target.value }))} className={fieldCls} /></label>
              {editCompteId && (
                <label className="block"><div className={labelCls}>Statut</div>
                  <select value={compteForm.statut} onChange={(e) => setCompteForm((f) => ({ ...f, statut: e.target.value }))} className={fieldCls}>
                    <option>Actif</option><option>Inactif</option>
                  </select>
                </label>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowCompteForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submittingCompte} onClick={handleSaveCompte} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal lot de chèques */}
      {showLotForm && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle plage de chèques</h3>
              <button type="button" onClick={() => setShowLotForm(false)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
            </div>
            <div className="p-5 space-y-3.5">
              {lotFormCompteId && (
                <p className="text-[12px] text-muted-foreground">
                  Compte : <span className="font-medium text-foreground">
                    {banques.find((b) => b.id === lotFormBanqueId)?.compteReglements.find((c) => c.id === lotFormCompteId)?.libelle}
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>N° début</div><input type="number" value={lotForm.numeroDebut} onChange={(e) => setLotForm((f) => ({ ...f, numeroDebut: e.target.value }))} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>N° fin</div><input type="number" value={lotForm.numeroFin} onChange={(e) => setLotForm((f) => ({ ...f, numeroFin: e.target.value }))} className={fieldCls} /></label>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowLotForm(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
              <button type="button" disabled={submittingLot} onClick={handleSaveLot} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal mouvements */}
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
                        <th className="py-2 pr-3 font-medium">Compte</th>
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
                          <td className="py-2 pr-3 text-muted-foreground">{m.compteReglementLibelle ?? "—"}</td>
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
