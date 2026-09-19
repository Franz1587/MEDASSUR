import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Mail, Plus, X, Eye, Search } from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { RichTextEditor } from "@/components/shared/RichTextEditor";
import { getClients } from "@/services/clients.service";
import { getPrestataires } from "@/services/prestataires.service";
import type { Client } from "@/types/clients";
import type { Prestataire } from "@/types/prestataires";
import {
  getCourriers, createCourrier, getCourrierTypes,
  type Courrier, type CourrierType,
} from "@/services/courrier.service";
import { openCourrier } from "@/services/documents.service";

const labelCls = "text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1";
const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";

type DestinataireMode = "Libre" | "Souscripteur" | "Prestataire";

// Substitution des jetons du modèle (2026-08) — voir CourrierType.corpsModele
// et demande utilisateur ("modèle courrier... paramétrable"). La référence
// réelle n'existe qu'après enregistrement (voir CourrierService.create) —
// le jeton affiche donc un texte d'attente tant que le courrier n'est pas
// encore sauvegardé.
function substituerJetons(html: string, params: { destinataire: string; date: string; objet: string }): string {
  return html
    .replace(/\{\{DESTINATAIRE\}\}/g, params.destinataire || "…")
    .replace(/\{\{DATE\}\}/g, params.date)
    .replace(/\{\{REFERENCE\}\}/g, "(attribuée à l'enregistrement)")
    .replace(/\{\{OBJET\}\}/g, params.objet || "…");
}

export default function CourrierMaladieView() {
  const [courriers, setCourriers] = useState<Courrier[]>([]);
  const [types, setTypes] = useState<CourrierType[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [prestataires, setPrestataires] = useState<Prestataire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [showEditeur, setShowEditeur] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  // ── Filtres ──────────────────────────────────────────────────────
  const [filtreReference, setFiltreReference] = useState("");
  const [filtreType, setFiltreType] = useState<CourrierType | null>(null);
  const [filtreDestinataire, setFiltreDestinataire] = useState("");
  const [filtreDu, setFiltreDu] = useState("");
  const [filtreAu, setFiltreAu] = useState("");

  const refresh = async () => {
    setChargement(true);
    try {
      const data = await getCourriers({
        reference: filtreReference || undefined,
        typeId: filtreType?.id,
        destinataire: filtreDestinataire || undefined,
        du: filtreDu || undefined,
        au: filtreAu || undefined,
      });
      setCourriers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement des courriers impossible.");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    Promise.all([getCourrierTypes(), getClients(), getPrestataires()])
      .then(([t, cl, pr]) => { setTypes(t.filter((x) => x.actif)); setClients(cl); setPrestataires(pr); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Chargement des référentiels impossible."));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refresh(); }, [filtreReference, filtreType, filtreDestinataire, filtreDu, filtreAu]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Éditeur ──────────────────────────────────────────────────────
  const [typeChoisi, setTypeChoisi] = useState<CourrierType | null>(null);
  const [destMode, setDestMode] = useState<DestinataireMode>("Libre");
  const [destClient, setDestClient] = useState<Client | null>(null);
  const [destPrestataire, setDestPrestataire] = useState<Prestataire | null>(null);
  const [destinataireNom, setDestinataireNom] = useState("");
  const [destinataireAdresse, setDestinataireAdresse] = useState("");
  const [objet, setObjet] = useState("");
  const [dateCreation, setDateCreation] = useState("");
  const [corps, setCorps] = useState("<p><br></p>");

  const resetEditeur = () => {
    setTypeChoisi(null); setDestMode("Libre"); setDestClient(null); setDestPrestataire(null);
    setDestinataireNom(""); setDestinataireAdresse(""); setObjet("");
    setDateCreation(format(new Date(), "dd/MM/yyyy")); setCorps("<p><br></p>");
  };

  const ouvrirEditeur = () => { resetEditeur(); setShowEditeur(true); };

  useEffect(() => {
    if (destMode === "Souscripteur" && destClient) {
      setDestinataireNom(destClient.nom);
      setDestinataireAdresse([destClient.adresse, destClient.ville].filter(Boolean).join(", "));
    } else if (destMode === "Prestataire" && destPrestataire) {
      setDestinataireNom(destPrestataire.nom);
      setDestinataireAdresse([destPrestataire.adresse, destPrestataire.ville].filter(Boolean).join(", "));
    }
  }, [destMode, destClient, destPrestataire]);

  const chargerModele = (t: CourrierType | null) => {
    setTypeChoisi(t);
    if (t) setCorps(substituerJetons(t.corpsModele, { destinataire: destinataireNom, date: dateCreation, objet }));
  };

  const handleEnregistrer = async () => {
    if (!destinataireNom.trim()) { toast.error("Le destinataire est obligatoire."); return; }
    if (!objet.trim()) { toast.error("L'objet est obligatoire."); return; }
    setEnregistrement(true);
    try {
      const courrier = await createCourrier({
        typeId: typeChoisi?.id,
        objet: objet.trim(),
        destinataireNom: destinataireNom.trim(),
        destinataireAdresse: destinataireAdresse || undefined,
        clientId: destMode === "Souscripteur" ? destClient?.id : undefined,
        prestataireId: destMode === "Prestataire" ? destPrestataire?.id : undefined,
        corps,
        dateCreation,
      });
      toast.success(`Courrier ${courrier.reference} enregistré.`);
      setShowEditeur(false);
      await refresh();
      await openCourrier(courrier.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement du courrier impossible.");
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <ModuleHeader
        title="Courrier Maladie"
        subtitle="Éditeur de courrier façon Word — modèles paramétrables, référence auto-générée"
        icon={Mail}
        actions={<Btn variant="primary" onClick={ouvrirEditeur}><Plus className="w-4 h-4" />Nouveau courrier</Btn>}
      />

      {/* ── Filtres ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/85 p-4 mb-5 grid grid-cols-1 md:grid-cols-5 gap-3">
        <label className="block"><div className={labelCls}>Référence</div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={filtreReference} onChange={(e) => setFiltreReference(e.target.value)} placeholder="Ex : COUR-2026" className={`${fieldCls} pl-8`} />
          </div>
        </label>
        <label className="block"><div className={labelCls}>Type</div>
          <Combobox options={types} value={filtreType} onChange={setFiltreType} getLabel={(t) => t.libelle} getId={(t) => t.id} allowClear clearLabel="Tous" placeholder="Tous" />
        </label>
        <label className="block"><div className={labelCls}>Destinataire</div>
          <input value={filtreDestinataire} onChange={(e) => setFiltreDestinataire(e.target.value)} placeholder="Nom du destinataire" className={fieldCls} />
        </label>
        <label className="block"><div className={labelCls}>Du</div><DateInput value={filtreDu} onChange={setFiltreDu} className={fieldCls} /></label>
        <label className="block"><div className={labelCls}>Au</div><DateInput value={filtreAu} onChange={setFiltreAu} className={fieldCls} /></label>
      </div>

      {/* ── Liste ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/70 bg-card/85 overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Référence</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Destinataire</th>
              <th className="px-4 py-2.5">Objet</th>
              <th className="px-4 py-2.5">Auteur</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {chargement && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Chargement…</td></tr>}
            {!chargement && courriers.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aucun courrier.</td></tr>}
            {courriers.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/20">
                <td className="px-4 py-2.5 font-semibold text-foreground med-num">{c.reference}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.type?.libelle ?? "—"}</td>
                <td className="px-4 py-2.5 text-foreground">{c.destinataireNom}</td>
                <td className="px-4 py-2.5 text-muted-foreground truncate max-w-xs">{c.objet}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{c.auteur.nom}</td>
                <td className="px-4 py-2.5 text-muted-foreground med-num">{c.dateCreation}</td>
                <td className="px-4 py-2.5 text-right">
                  <Btn variant="secondary" onClick={() => openCourrier(c.id)}><Eye className="w-3.5 h-3.5" />Voir le PDF</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Éditeur plein écran ──────────────────────────────────── */}
      {showEditeur && (
        <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[94vh] flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <h3 className="text-[15px] font-semibold text-foreground">Nouveau courrier</h3>
              <button type="button" onClick={() => setShowEditeur(false)} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><div className={labelCls}>Modèle (facultatif)</div>
                  <Combobox options={types} value={typeChoisi} onChange={chargerModele} getLabel={(t) => t.libelle} getId={(t) => t.id} allowClear clearLabel="Aucun modèle — page blanche" placeholder="Choisir un modèle…" />
                </label>
                <label className="block"><div className={labelCls}>Date</div><DateInput value={dateCreation} onChange={setDateCreation} className={fieldCls} /></label>
              </div>

              <div>
                <div className={labelCls}>Destinataire</div>
                <div className="flex items-center gap-1.5 mb-2">
                  {(["Libre", "Souscripteur", "Prestataire"] as DestinataireMode[]).map((m) => (
                    <button key={m} type="button" onClick={() => { setDestMode(m); setDestClient(null); setDestPrestataire(null); if (m === "Libre") { setDestinataireNom(""); setDestinataireAdresse(""); } }}
                      className={`h-7 px-3 rounded-lg text-[12px] font-medium border ${destMode === m ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {destMode === "Souscripteur" && (
                  <Combobox options={clients} value={destClient} onChange={setDestClient} getLabel={(c) => c.nom} getId={(c) => c.id} placeholder="Rechercher un souscripteur…" />
                )}
                {destMode === "Prestataire" && (
                  <Combobox options={prestataires} value={destPrestataire} onChange={setDestPrestataire} getLabel={(p) => p.nom} getId={(p) => p.id} placeholder="Rechercher un prestataire…" />
                )}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <label className="block"><div className={labelCls}>Nom du destinataire</div><input value={destinataireNom} onChange={(e) => setDestinataireNom(e.target.value)} disabled={destMode !== "Libre"} className={`${fieldCls} disabled:opacity-70`} /></label>
                  <label className="block"><div className={labelCls}>Adresse (facultatif)</div><input value={destinataireAdresse} onChange={(e) => setDestinataireAdresse(e.target.value)} disabled={destMode !== "Libre"} className={`${fieldCls} disabled:opacity-70`} /></label>
                </div>
              </div>

              <label className="block"><div className={labelCls}>Objet</div><input value={objet} onChange={(e) => setObjet(e.target.value)} className={fieldCls} /></label>

              <label className="block"><div className={labelCls}>Corps du courrier</div>
                <RichTextEditor value={corps} onChange={setCorps} placeholder="Rédigez le courrier…" />
              </label>
            </div>

            <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end gap-2">
              <Btn variant="secondary" onClick={() => setShowEditeur(false)}>Annuler</Btn>
              <Btn variant="primary" disabled={enregistrement} onClick={handleEnregistrer}>Enregistrer et générer le PDF</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
