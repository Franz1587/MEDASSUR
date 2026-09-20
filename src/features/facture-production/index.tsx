import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileSpreadsheet, Plus, Trash2, X, Eye, Search } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { Pagination } from "@/components/shared/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { fmtM } from "@/lib/format";
import { getCompagnies } from "@/services/compagnies.service";
import { getClients } from "@/services/clients.service";
import type { Compagnie } from "@/types/compagnies";
import type { Client } from "@/types/clients";
import {
  getFacturesProduction, createFactureProduction, getMouvementsNonFactures, getObjetsSuggeres,
  TYPES_PAIEMENT_FACTURE_PRODUCTION,
  type FactureProduction, type FactureProductionLigneInput,
} from "@/services/facture-production.service";
import { openFactureProduction } from "@/services/documents.service";

const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1";
const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";

function ligneVide(): FactureProductionLigneInput {
  return { libelle: "", periodeDebut: "", periodeFin: "", montant: 0 };
}

export default function FactureProductionView() {
  const [factures, setFactures] = useState<FactureProduction[]>([]);
  const [compagnies, setCompagnies] = useState<Compagnie[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [objetsSuggeres, setObjetsSuggeres] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const pagination = usePagination(factures);

  // ── Filtres de recherche ──────────────────────────────────────────
  const [filtreCompagnie, setFiltreCompagnie] = useState<Compagnie | null>(null);
  const [filtreClient, setFiltreClient] = useState<Client | null>(null);
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");
  const [filtreReference, setFiltreReference] = useState("");

  const refresh = async () => {
    setChargement(true);
    try {
      const data = await getFacturesProduction({
        compagnieId: filtreCompagnie?.id,
        clientId: filtreClient?.id,
        du: filtreDu || undefined,
        au: filtreAu || undefined,
        reference: filtreReference || undefined,
      });
      setFactures(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement des factures de production impossible.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    Promise.all([getCompagnies(), getClients(), getObjetsSuggeres()])
      .then(([c, cl, o]) => { setCompagnies(c); setClients(cl); setObjetsSuggeres(o); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Chargement des référentiels impossible."));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); }, [filtreCompagnie, filtreClient, filtreDu, filtreAu, filtreReference]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Formulaire de création ───────────────────────────────────────
  const [formClient, setFormClient] = useState<Client | null>(null);
  const [formCompagnie, setFormCompagnie] = useState<Compagnie | null>(null);
  const [chargementMouvements, setChargementMouvements] = useState(false);
  const [compagniesMouvements, setCompagniesMouvements] = useState<string[]>([]);
  const [dateEmission, setDateEmission] = useState("");
  const [lieuEmission, setLieuEmission] = useState("Libreville");
  const [referenceBonReception, setReferenceBonReception] = useState("");
  const [referenceBonCommande, setReferenceBonCommande] = useState("");
  const [objet, setObjet] = useState("");
  const [typePaiement, setTypePaiement] = useState<string>(TYPES_PAIEMENT_FACTURE_PRODUCTION[0]);
  const [notePaiement, setNotePaiement] = useState("");
  const [notePaiementTouchee, setNotePaiementTouchee] = useState(false);
  const [lignes, setLignes] = useState<FactureProductionLigneInput[]>([ligneVide()]);

  const resetForm = () => {
    setFormClient(null); setFormCompagnie(null); setCompagniesMouvements([]);
    setDateEmission(format(new Date(), "dd/MM/yyyy")); setLieuEmission("Libreville");
    setReferenceBonReception(""); setReferenceBonCommande("");
    setObjet(""); setTypePaiement(TYPES_PAIEMENT_FACTURE_PRODUCTION[0]); setNotePaiement(""); setNotePaiementTouchee(false); setLignes([ligneVide()]);
  };

  // Souscripteur choisi → mouvements (Affaire Nouvelle/Avenant) pas encore
  // facturés, filtrés par compagnie dès qu'elle est renseignée. Remplace
  // entièrement les lignes courantes par les mouvements trouvés (voir
  // demande utilisateur : "l'application doit remplir automatiquement les
  // lignes de la facture") — l'utilisateur garde la main pour ajuster ou
  // ajouter des lignes ensuite.
  useEffect(() => {
    if (!formClient) { setCompagniesMouvements([]); return; }
    setChargementMouvements(true);
    getMouvementsNonFactures(formClient.id, formCompagnie?.id)
      .then((mvts) => {
        const compagniesTrouvees = [...new Set(mvts.map((m) => m.compagnieId))];
        setCompagniesMouvements(compagniesTrouvees);
        if (mvts.length === 0) return;
        if (!formCompagnie && compagniesTrouvees.length === 1) {
          setFormCompagnie(compagnies.find((c) => c.id === compagniesTrouvees[0]) ?? null);
          return; // le changement de formCompagnie relancera cet effet, filtré cette fois
        }
        if (!formCompagnie && compagniesTrouvees.length > 1) return; // ambigu — attend le choix de la compagnie
        setLignes(mvts.map((m) => ({
          libelle: m.libelle, periodeDebut: m.periodeDebut ?? "", periodeFin: m.periodeFin ?? "",
          montant: m.montant, contratId: m.contratId, avenantId: m.avenantId ?? undefined,
        })));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Recherche des mouvements impossible."))
      .finally(() => setChargementMouvements(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formClient, formCompagnie]);

  // Note de paiement pré-remplie depuis le modèle de la compagnie, tant que
  // l'utilisateur n'a pas lui-même modifié le champ (voir demande
  // utilisateur : "récupérer le texte du modèle... texte doit être pré-rempli").
  useEffect(() => {
    if (formCompagnie?.notePaiementDefaut && !notePaiementTouchee) setNotePaiement(formCompagnie.notePaiementDefaut);
  }, [formCompagnie, notePaiementTouchee]);

  const totalLignes = useMemo(() => lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0), [lignes]);

  const majLigne = (i: number, patch: Partial<FactureProductionLigneInput>) => {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const handleCreer = async () => {
    if (!formCompagnie || !formClient) { toast.error("Choisissez un souscripteur et une compagnie."); return; }
    if (!dateEmission) { toast.error("La date d'émission est obligatoire."); return; }
    if (!objet.trim()) { toast.error("L'objet de la facture est obligatoire."); return; }
    const lignesValides = lignes.filter((l) => l.libelle.trim() && l.montant > 0);
    if (lignesValides.length === 0) { toast.error("Ajoutez au moins une ligne avec un libellé et un montant."); return; }

    setEnregistrement(true);
    try {
      const facture = await createFactureProduction({
        compagnieId: formCompagnie.id, clientId: formClient.id,
        dateEmission, lieuEmission,
        referenceBonReception: referenceBonReception || undefined,
        referenceBonCommande: referenceBonCommande || undefined,
        objet: objet.trim(),
        typePaiement,
        notePaiement: notePaiement || undefined,
        lignes: lignesValides,
      });
      toast.success(`Facture de production N°${facture.numero} créée.`);
      setShowCreate(false);
      resetForm();
      await refresh();
      await openFactureProduction(facture.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Création de la facture de production impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <ModuleHeader
        title="Facture Production"
        subtitle="Facture émise par opération de production, sur le papier en-tête de la compagnie"
        icon={FileSpreadsheet}
        actions={
          <Btn variant="primary" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="w-4 h-4" />Nouvelle facture de production
          </Btn>
        }
      />

      {/* ── Filtres ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/85 p-4 mb-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="block"><div className={labelCls}>Compagnie</div>
          <Combobox options={compagnies} value={filtreCompagnie} onChange={setFiltreCompagnie} getLabel={(c) => c.nom} getId={(c) => c.id} allowClear clearLabel="Toutes" placeholder="Toutes" />
        </label>
        <label className="block"><div className={labelCls}>Souscripteur</div>
          <Combobox options={clients} value={filtreClient} onChange={setFiltreClient} getLabel={(c) => c.nom} getId={(c) => c.id} allowClear clearLabel="Tous" placeholder="Tous" />
        </label>
        <label className="block"><div className={labelCls}>Du</div><DateInput value={filtreDu} onChange={setFiltreDu} className={fieldCls} /></label>
        <label className="block"><div className={labelCls}>Au</div><DateInput value={filtreAu} onChange={setFiltreAu} className={fieldCls} /></label>
        <label className="block"><div className={labelCls}>N° Facture</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={filtreReference} onChange={(e) => setFiltreReference(e.target.value)} placeholder="Ex : 12" className={`${fieldCls} pl-8`} />
          </div>
        </label>
      </div>

      {/* ── Liste ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/85 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">N° Facture</th>
              <th className="px-4 py-2.5">Compagnie</th>
              <th className="px-4 py-2.5">Souscripteur</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Objet</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {chargement && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Chargement…</td></tr>}
            {!chargement && factures.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucune facture de production.</td></tr>}
            {pagination.pageItems.map((f) => {
              const total = f.lignes.reduce((s, l) => s + Number(l.montant), 0);
              return (
                <tr key={f.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-2.5 font-semibold text-foreground med-num">{f.numero}</td>
                  <td className="px-4 py-2.5 text-foreground">{f.compagnie.nom}</td>
                  <td className="px-4 py-2.5 text-foreground">{f.client.nom}</td>
                  <td className="px-4 py-2.5 text-muted-foreground med-num">{f.dateEmission}</td>
                  <td className="px-4 py-2.5 text-muted-foreground truncate max-w-xs">{f.objet}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-foreground med-num">{fmtM(total)} F CFA</td>
                  <td className="px-4 py-2.5 text-right">
                    <Btn variant="secondary" onClick={() => openFactureProduction(f.id)}><Eye className="w-3.5 h-3.5" />Voir le PDF</Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination
          page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize}
          pageSizeOptions={pagination.pageSizeOptions} total={pagination.total} debut={pagination.debut} fin={pagination.fin}
          onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
        />
      </div>

      {/* ── Modal création ───────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle facture de production</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <label className="block"><div className={labelCls}>Souscripteur</div>
                <Combobox
                  options={clients} value={formClient} onChange={(c) => { setFormClient(c); setFormCompagnie(null); }}
                  getLabel={(c) => c.nom} getId={(c) => c.id} placeholder="Rechercher un souscripteur…"
                />
                {chargementMouvements && <p className="text-[11px] text-muted-foreground mt-1">Recherche des mouvements non facturés…</p>}
                {!chargementMouvements && formClient && compagniesMouvements.length > 1 && !formCompagnie && (
                  <p className="text-[11px] text-amber-600 mt-1">Ce souscripteur a des mouvements chez plusieurs compagnies — choisissez la compagnie ci-dessous pour remplir les lignes.</p>
                )}
                {!chargementMouvements && formClient && compagniesMouvements.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">Aucun mouvement en attente de facturation pour ce souscripteur — saisie libre des lignes.</p>
                )}
              </label>

              <label className="block"><div className={labelCls}>Compagnie</div>
                <Combobox options={compagnies} value={formCompagnie} onChange={setFormCompagnie} getLabel={(c) => c.nom} getId={(c) => c.id} placeholder="Choisir…" />
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block"><div className={labelCls}>Date d'émission</div><DateInput value={dateEmission} onChange={setDateEmission} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Lieu d'émission</div><input value={lieuEmission} onChange={(e) => setLieuEmission(e.target.value)} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Bon de Réception N° (facultatif)</div><input value={referenceBonReception} onChange={(e) => setReferenceBonReception(e.target.value)} className={fieldCls} /></label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block"><div className={labelCls}>Bon de Commande N° (facultatif)</div><input value={referenceBonCommande} onChange={(e) => setReferenceBonCommande(e.target.value)} className={fieldCls} /></label>
                <label className="block"><div className={labelCls}>Objet</div>
                  <input value={objet} onChange={(e) => setObjet(e.target.value)} list="objets-facture-production" placeholder="Ex : RENOUVELLEMENT PRESTATIONS SANTE" className={fieldCls} />
                  <datalist id="objets-facture-production">
                    {objetsSuggeres.map((o) => <option key={o} value={o} />)}
                  </datalist>
                </label>
                <label className="block"><div className={labelCls}>Type de paiement</div>
                  <select value={typePaiement} onChange={(e) => setTypePaiement(e.target.value)} className={fieldCls}>
                    {TYPES_PAIEMENT_FACTURE_PRODUCTION.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              <label className="block"><div className={labelCls}>Note de paiement (facultatif)</div>
                <textarea value={notePaiement} onChange={(e) => { setNotePaiement(e.target.value); setNotePaiementTouchee(true); }} rows={3} className={fieldCls} />
              </label>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={labelCls}>Lignes de la facture</div>
                  <Btn variant="secondary" onClick={() => setLignes((ls) => [...ls, ligneVide()])}><Plus className="w-3.5 h-3.5" />Ajouter une ligne</Btn>
                </div>
                <div className="space-y-2">
                  {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start border border-border/60 rounded-lg p-2.5">
                      <input value={l.libelle} onChange={(e) => majLigne(i, { libelle: e.target.value })} placeholder="Libellé (ex : POLICE MALADIE N°...)" className={`${fieldCls} col-span-5`} />
                      <div className="col-span-2"><DateInput value={l.periodeDebut ?? ""} onChange={(v) => majLigne(i, { periodeDebut: v })} placeholder="Début" className={fieldCls} /></div>
                      <div className="col-span-2"><DateInput value={l.periodeFin ?? ""} onChange={(v) => majLigne(i, { periodeFin: v })} placeholder="Fin" className={fieldCls} /></div>
                      <input type="number" value={l.montant || ""} onChange={(e) => majLigne(i, { montant: Number(e.target.value) })} placeholder="Montant" className={`${fieldCls} col-span-2 text-right`} />
                      <button type="button" onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))} disabled={lignes.length === 1} className="col-span-1 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-right mt-2 text-[13px] font-semibold text-foreground med-num">Total : {fmtM(totalLignes)} F CFA</div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowCreate(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={enregistrement} onClick={handleCreer}>Générer la facture</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
