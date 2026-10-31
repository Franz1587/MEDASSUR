import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, ImagePlus, Loader2, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { fmtM } from "@/lib/format";
import { useAuth } from "@/auth/AuthContext";
import { createProspect, getProspects, prospectLogoUrl, uploadProspectLogo, type ProspectUpsertInput } from "@/services/crm.service";
import { analyserDocumentAppelOffres, createAppelOffres, getAppelOffres, uploaderDocumentAppelOffres } from "@/services/appelOffres.service";
import { OffreSantePanel, RelectureCotationModal } from "@/features/appel-offres/OffreSante";
import type { Compagnie } from "@/types/compagnies";
import type { Cotation } from "@/types/cotation";
import type { AppelOffres } from "@/types/appelOffres";
import type { Prospect } from "@/types/crm";

// Cotation par import (2026-10) — voir demande utilisateur : depuis l'onglet
// Cotation, un bouton qui ouvre une fenêtre où l'on renseigne le prospect,
// son logo et les propositions des compagnies ; ARIANA les analyse et monte
// l'offre. Enchaîne les services existants (prospect, appel d'offres,
// import, lecture ARIANA) : l'appel d'offres créé reste consultable dans
// l'écran Appels d'Offres.

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";
const FORMATS = ".pdf,.png,.jpg,.jpeg,.webp";

type Etape = "prospect" | "propositions" | "offre";

// Le client HTTP renvoie « POST /… failed (503): {"message":"…"} » : on
// n'affiche que la phrase destinée à l'utilisateur.
function messageLisible(err: unknown): string {
  const brut = err instanceof Error ? err.message : "Lecture impossible.";
  const m = brut.match(/"message":"((?:[^"\\]|\\.)*)"/);
  return m ? m[1].replace(/\\"/g, '"') : brut;
}
interface Fichier { cle: string; file: File; compagnieId: string; statut: "attente" | "lecture" | "ok" | "erreur"; message?: string; documentId?: string }

export function CotationParImportModal({ compagnies, onClose }: { compagnies: Compagnie[]; onClose: () => void }) {
  const { currentUser } = useAuth();
  const [etape, setEtape] = useState<Etape>("prospect");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [nouveau, setNouveau] = useState(true);
  const [prospectId, setProspectId] = useState("");
  const [form, setForm] = useState({ nom: "", effectif: "", adresse: "", contactNom: "", contactTelephone: "", contactEmail: "", garanties: "Maladie — Gabon uniquement" });
  const [logo, setLogo] = useState<File | null>(null);
  const [fichiers, setFichiers] = useState<Fichier[]>([]);
  const [style, setStyle] = useState<"auto" | "grille" | "colonnes">("auto");
  const [ao, setAo] = useState<AppelOffres | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [relecture, setRelecture] = useState<Cotation | null>(null);
  const inputFichiers = useRef<HTMLInputElement>(null);

  useEffect(() => { getProspects().then(setProspects).catch(() => undefined); }, []);
  const prospect = prospects.find((p) => p.id === prospectId) ?? null;
  const logoApercu = logo ? URL.createObjectURL(logo) : prospect?.logo ? prospectLogoUrl(prospect.logo) : undefined;
  const nomClient = nouveau ? form.nom.trim() : prospect?.nom ?? "";

  const ajouterFichiers = (liste: FileList | null) => {
    if (!liste) return;
    // Copie immédiate : vider l'input (pour réimporter le même fichier) vide aussi sa FileList.
    const nouveaux = Array.from(liste);
    setFichiers((f) => [...f, ...nouveaux.map((file) => ({ cle: `${file.name}-${file.size}-${Math.random()}`, file, compagnieId: "", statut: "attente" as const }))]);
  };
  const majFichier = (cle: string, p: Partial<Fichier>) => setFichiers((f) => f.map((x) => (x.cle === cle ? { ...x, ...p } : x)));

  const continuer = () => {
    if (!nomClient) { toast.error(nouveau ? "Renseignez le nom du prospect." : "Choisissez un prospect."); return; }
    setEtape("propositions");
  };

  // Prospect + logo + appel d'offres, créés une seule fois même si
  // l'analyse est relancée.
  const preparer = async (): Promise<AppelOffres> => {
    if (ao) return ao;
    let id = prospectId;
    if (nouveau) {
      const payload: ProspectUpsertInput = {
        nom: form.nom.trim(), type: "Entreprise", source: "Cotation par import", etape: "Proposition envoyée", valeurEstimee: 0,
        commercial: currentUser?.nom ?? "", dernierContact: new Date().toLocaleDateString("fr-FR"),
        contactNom: form.contactNom, contactFonction: "", contactTelephone: form.contactTelephone, contactEmail: form.contactEmail,
        typeContrat: "MaladieEtAssistance",
        ...(Number(form.effectif) > 0 ? { effectifEstime: Number(form.effectif) } : {}),
        ...(form.adresse.trim() ? { zoneGeographique: form.adresse.trim() } : {}),
      };
      const cree = await createProspect(payload);
      id = cree.id;
      setProspects((l) => [...l, cree]);
      setProspectId(id);
      setNouveau(false);
    }
    if (logo) await uploadProspectLogo(id, logo);
    const cree = await createAppelOffres({
      prospectId: id, clientNom: nomClient, cahierCharges: `Cotation par import${Number(form.effectif) > 0 ? ` — ${form.effectif} personnes` : ""}`,
      garantiesDemandees: form.garanties || "Maladie", projectionSP: 0, estimationPepm: 0, estimationFondsRoulement: 0,
    });
    setAo(cree);
    return cree;
  };

  const analyser = async (seulement?: string) => {
    const aTraiter = fichiers.filter((f) => (seulement ? f.cle === seulement : f.statut !== "ok"));
    if (!aTraiter.length) { toast.error("Ajoutez au moins une proposition de compagnie."); return; }
    setEnCours(true);
    let erreurs = 0;
    try {
      const appel = await preparer();
      for (const f of aTraiter) {
        majFichier(f.cle, { statut: "lecture", message: undefined });
        try {
          let documentId = f.documentId;
          if (!documentId) {
            const maj = await uploaderDocumentAppelOffres(appel.id, f.file, { type: "Offre compagnie", compagnieId: f.compagnieId || undefined });
            documentId = maj.documents.filter((d) => d.nom === f.file.name).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
            if (!documentId) throw new Error("Document importé introuvable.");
            majFichier(f.cle, { documentId });
          }
          const r = await analyserDocumentAppelOffres(appel.id, documentId, { style });
          const aVerifier = r.cotations.filter((c) => c.contenuOffre?.remarques).length;
          majFichier(f.cle, { statut: "ok", message: `${r.compagnie} · ${r.cotations.length} proposition(s)${aVerifier ? ` · ${aVerifier} à vérifier` : ""}` });
        } catch (err) {
          erreurs++;
          majFichier(f.cle, { statut: "erreur", message: messageLisible(err) });
        }
      }
      setAo(await getAppelOffres(appel.id));
      if (!erreurs) setEtape("offre");
      else toast.error(`${erreurs} document(s) non lu(s) : relancez-les ou retirez-les.`);
    } catch (err) {
      toast.error(messageLisible(err));
    } finally {
      setEnCours(false);
    }
  };

  const rafraichir = async () => { if (ao) setAo(await getAppelOffres(ao.id)); };
  const nbOk = fichiers.filter((f) => f.statut === "ok").length;

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cpi-titre">
      <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h3 id="cpi-titre" className="text-[15px] font-semibold text-foreground inline-flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />Cotation par import</h3>
            <p className="text-[12px] text-muted-foreground truncate">
              {etape === "prospect" ? "1. Prospect" : etape === "propositions" ? "2. Propositions des compagnies" : "3. Offre santé"}{nomClient ? ` — ${nomClient}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={enCours} aria-label="Fermer" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary/40 disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {etape === "prospect" && (
            <>
              <div className="inline-flex rounded-lg border border-border p-1 bg-secondary/30" role="tablist">
                {[["Nouveau prospect", true], ["Prospect existant", false]].map(([l, v]) => (
                  <button key={String(l)} type="button" role="tab" aria-selected={nouveau === v} onClick={() => setNouveau(v as boolean)}
                    className={`h-9 px-3 rounded-md text-[13px] ${nouveau === v ? "bg-card text-foreground font-semibold shadow-sm" : "text-muted-foreground"}`}>{l as string}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nouveau ? (
                    <>
                      <label className="block sm:col-span-2"><div className={labelCls}>Nom du prospect *</div>
                        <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={fieldCls} placeholder="ex. LAY PRO" /></label>
                      <label className="block"><div className={labelCls}>Effectif à assurer</div>
                        <input type="number" min={1} value={form.effectif} onChange={(e) => setForm({ ...form, effectif: e.target.value })} className={fieldCls} /></label>
                      <label className="block"><div className={labelCls}>Adresse</div>
                        <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className={fieldCls} placeholder="ex. BP 7054 Libreville" /></label>
                      <label className="block"><div className={labelCls}>Contact</div>
                        <input value={form.contactNom} onChange={(e) => setForm({ ...form, contactNom: e.target.value })} className={fieldCls} /></label>
                      <label className="block"><div className={labelCls}>Téléphone</div>
                        <input value={form.contactTelephone} onChange={(e) => setForm({ ...form, contactTelephone: e.target.value })} className={fieldCls} /></label>
                      <label className="block sm:col-span-2"><div className={labelCls}>E-mail</div>
                        <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className={fieldCls} /></label>
                    </>
                  ) : (
                    <label className="block sm:col-span-2"><div className={labelCls}>Prospect *</div>
                      <Combobox options={prospects} value={prospect} onChange={(p) => setProspectId(p?.id ?? "")} getLabel={(p) => p.nom} getId={(p) => p.id} placeholder="Rechercher un prospect…" /></label>
                  )}
                  <label className="block sm:col-span-2"><div className={labelCls}>Garanties demandées (aide ARIANA à retenir les bonnes options)</div>
                    <input value={form.garanties} onChange={(e) => setForm({ ...form, garanties: e.target.value })} className={fieldCls} /></label>
                </div>
                <div>
                  <div className={labelCls}>Logo du prospect</div>
                  <label className="h-36 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-[12px] text-muted-foreground cursor-pointer hover:bg-secondary/30 overflow-hidden">
                    {logoApercu ? <img src={logoApercu} alt="Logo du prospect" className="max-h-full max-w-full object-contain p-2" /> : <><ImagePlus className="w-6 h-6" />Choisir une image</>}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-1.5">Imprimé sur la couverture et chaque bandeau de l'offre.</p>
                </div>
              </div>
            </>
          )}

          {etape === "propositions" && (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (!enCours) ajouterFichiers(e.dataTransfer.files); }}
                className="rounded-xl border-2 border-dashed border-border p-6 text-center"
              >
                <FileUp className="w-7 h-7 mx-auto text-primary mb-2" />
                <p className="text-[13px] text-foreground font-medium">Déposez ici les propositions des compagnies</p>
                <p className="text-[12px] text-muted-foreground mb-3">PDF ou photos, scans compris — un fichier par proposition ou par collège.</p>
                <Btn variant="secondary" disabled={enCours} onClick={() => inputFichiers.current?.click()}>Choisir des fichiers</Btn>
                <input ref={inputFichiers} type="file" multiple accept={FORMATS} className="hidden" onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ""; }} />
              </div>

              {fichiers.length > 0 && (
                <div className="space-y-2">
                  {fichiers.map((f) => (
                    <div key={f.cle} className="rounded-lg border border-border px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <div className="flex-1 basis-56 min-w-0">
                        <p className="text-[13px] text-foreground truncate" title={f.file.name}>{f.file.name}</p>
                        <p className={`text-[11.5px] ${f.statut === "erreur" ? "text-destructive" : "text-muted-foreground"}`}>
                          {f.statut === "attente" && "En attente d'analyse"}
                          {f.statut === "lecture" && "ARIANA lit le document…"}
                          {(f.statut === "ok" || f.statut === "erreur") && f.message}
                        </p>
                      </div>
                      <div className="w-56 max-w-full">
                        <Combobox options={compagnies} value={compagnies.find((c) => c.id === f.compagnieId) ?? null}
                          onChange={(c) => majFichier(f.cle, { compagnieId: c?.id ?? "" })} getLabel={(c) => c.nom} getId={(c) => c.id}
                          placeholder="Compagnie : détection auto" />
                      </div>
                      <span className="w-8 flex justify-center" aria-live="polite">
                        {f.statut === "lecture" && <Loader2 className="w-4 h-4 animate-spin text-primary" aria-label="Lecture en cours" />}
                        {f.statut === "ok" && <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-label="Lu" />}
                        {f.statut === "erreur" && (
                          <button type="button" disabled={enCours} onClick={() => analyser(f.cle)} aria-label="Relancer l'analyse" className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10"><RotateCcw className="w-4 h-4" /></button>
                        )}
                      </span>
                      <button type="button" disabled={enCours || f.statut === "ok"} onClick={() => setFichiers((l) => l.filter((x) => x.cle !== f.cle))} aria-label="Retirer ce fichier"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 text-[12.5px]">
                <span className="text-muted-foreground">Tableau de garanties :</span>
                <select value={style} onChange={(e) => setStyle(e.target.value as typeof style)} disabled={enCours} className="h-9 px-2 rounded-lg border border-border bg-background text-[12.5px] text-foreground">
                  <option value="auto">Choix d'ARIANA selon la proposition</option>
                  <option value="grille">Grille LA RUCHE (rubriques)</option>
                  <option value="colonnes">Colonnes Garanties / Taux / Plafond</option>
                </select>
              </div>
            </>
          )}

          {etape === "offre" && ao && (
            <>
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="font-semibold text-foreground text-sm mb-2">Propositions lues par ARIANA</h4>
                <div className="space-y-1.5">
                  {ao.cotations.filter((c) => c.contenuOffre).map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-secondary/30 text-[12.5px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-foreground">{c.compagnie?.nom ?? "Compagnie à choisir"}</span>
                        <Badge variant="gold">{c.branche}</Badge>
                        <span className="text-muted-foreground truncate">{c.contenuOffre?.libelleComparatif}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {c.contenuOffre?.remarques && <span title={c.contenuOffre.remarques}><AlertTriangle className="w-4 h-4 text-amber-500" aria-label="Points à vérifier" /></span>}
                        <span className="font-semibold text-foreground med-num">{c.contenuOffre?.primeNonCommuniquee ? "Non communiqué" : `${fmtM(c.primeTTC)} FCFA`}</span>
                        <button type="button" onClick={() => setRelecture(c)} className="text-[12px] text-primary hover:underline">Relire</button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <OffreSantePanel appelOffresId={ao.id} cotations={ao.cotations} />
              <p className="text-[11.5px] text-muted-foreground">Cette cotation est aussi enregistrée dans Appels d'Offres ({ao.id}), avec ses documents.</p>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div>
            {etape === "propositions" && <Btn variant="ghost" disabled={enCours} onClick={() => setEtape("prospect")}>Retour</Btn>}
            {etape === "offre" && <Btn variant="ghost" onClick={() => setEtape("propositions")}>Ajouter des propositions</Btn>}
          </div>
          <div className="flex items-center gap-2">
            {etape === "prospect" && <Btn variant="primary" onClick={continuer}>Continuer</Btn>}
            {etape === "propositions" && (
              <>
                {nbOk > 0 && !enCours && <Btn variant="secondary" onClick={() => setEtape("offre")}>Voir l'offre ({nbOk})</Btn>}
                <Btn variant="primary" disabled={enCours || !fichiers.some((f) => f.statut !== "ok")} onClick={async () => { await analyser(); }}>
                  {enCours ? <><Loader2 className="w-4 h-4 animate-spin" />Analyse en cours…</> : <><Sparkles className="w-4 h-4" />Analyser avec ARIANA</>}
                </Btn>
              </>
            )}
            {etape === "offre" && <Btn variant="secondary" onClick={onClose}>Terminer</Btn>}
          </div>
        </div>
      </div>

      {relecture && (
        <RelectureCotationModal cotation={relecture} compagnies={compagnies} onClose={() => setRelecture(null)}
          onSaved={async () => { setRelecture(null); await rafraichir(); }} />
      )}
    </div>
  );
}
