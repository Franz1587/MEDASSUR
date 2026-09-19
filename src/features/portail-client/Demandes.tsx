import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, UserPlus, UserMinus, Trash2, Camera } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { getMesContrats, getMesParticipants } from "@/services/portailClient.service";
import { createDemandeClient, getMesDemandesClient, uploadPhotoBeneficiaireDemande } from "@/services/demandeClient.service";
import { QueuedOfflineError } from "@/lib/http";
import type { Contrat } from "@/types/contrats";
import type { AssureSante } from "@/types/sante";
import type { BeneficiaireInput, CreateDemandeClientInput, DemandeClient } from "@/types/demandeClient";

function statutVariant(statut: string): BadgeVariant {
  if (statut === "Accordée") return "success";
  if (statut === "Refusée") return "danger";
  return "warning";
}

const LABEL_TYPE: Record<string, string> = { AS: "Assuré principal", CJ: "Conjoint", EF: "Enfant" };

const labelCls = "text-[11px] font-medium text-muted-foreground mb-1";
const fieldCls = "w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground";

function emptyForm(): CreateDemandeClientInput {
  return { contratId: "", type: "Incorporation", dateDemande: format(new Date(), "dd/MM/yyyy") };
}

function emptyMini(): BeneficiaireInput {
  return { typeAssure: "CJ", nom: "" };
}

// Famille d'accueil d'un conjoint/enfant — soit un assuré principal déjà
// présent sur le contrat, soit celui ajouté DANS CETTE MÊME demande (voir
// demande utilisateur : "s'il s'agit d'un assuré principal il faut rendre
// possible aussi l'ajout de ses ayants droit").
interface OptionFamille { id: string; label: string; refLocale: boolean }

// Aperçu d'une photo choisie localement (pas encore envoyée) — voir demande
// utilisateur : "il faut qu'on ait un affichage de la photo dans le
// formulaire de création à l'incorporation". Le File n'a pas d'URL tant
// qu'on ne l'a pas transformé via URL.createObjectURL ; on la révoque au
// démontage/changement pour ne pas fuiter de mémoire.
function PhotoThumb({ file, size = "w-7 h-7" }: { file?: File; size?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;
  return <img src={url} alt="" className={`${size} rounded-full object-cover border border-border inline-block align-middle`} />;
}

// Demandes de mouvement de population initiées par le souscripteur
// (2026-08) — voir demande utilisateur : "initier des opérations comme des
// incorporations et retrait, mais la validation finale revient au
// gestionnaire côté assurance". Le statut reste "En attente" tant qu'un
// gestionnaire ne l'a pas tranchée (voir écran interne "Demandes client").
// Une incorporation peut porter plusieurs bénéficiaires (assuré principal +
// ayants droit) rattachés à une famille précise.
export default function PortailDemandesView() {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [demandes, setDemandes] = useState<DemandeClient[]>([]);
  const [participants, setParticipants] = useState<AssureSante[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateDemandeClientInput>(emptyForm());
  const [contratChoisi, setContratChoisi] = useState<Contrat | null>(null);
  const [assureChoisi, setAssureChoisi] = useState<AssureSante | null>(null);
  const [beneficiairesForm, setBeneficiairesForm] = useState<BeneficiaireInput[]>([]);
  const [mini, setMini] = useState<BeneficiaireInput>(emptyMini());
  const [familleChoisie, setFamilleChoisie] = useState<OptionFamille | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const refresh = () => getMesDemandesClient().then(setDemandes);

  useEffect(() => {
    getMesContrats().then(setContrats);
    refresh();
  }, []);

  useEffect(() => {
    if (form.contratId) getMesParticipants(form.contratId).then(setParticipants);
    else setParticipants([]);
  }, [form.contratId]);

  const openCreate = () => {
    setForm(emptyForm());
    setContratChoisi(null);
    setAssureChoisi(null);
    setBeneficiairesForm([]);
    setMini(emptyMini());
    setFamilleChoisie(null);
    setErreur(null);
    setShowCreate(true);
  };

  const asLocal = beneficiairesForm.find((b) => b.typeAssure === "AS");
  const optionsFamille: OptionFamille[] = [
    ...participants.filter((p) => p.typeAssure === "AS").map((p) => ({ id: p.id, label: `${p.nom} ${p.prenom ?? ""} (${p.matricule})`, refLocale: false })),
    ...(asLocal ? [{ id: "LOCAL", label: `${asLocal.nom} ${asLocal.prenom ?? ""} — nouvel assuré principal de cette demande`, refLocale: true }] : []),
  ];

  const ajouterBeneficiaire = () => {
    if (!mini.nom.trim()) { setErreur("Le nom du bénéficiaire est requis."); return; }
    if (mini.typeAssure === "AS" && beneficiairesForm.some((b) => b.typeAssure === "AS")) { setErreur("Un seul assuré principal par demande."); return; }
    if (mini.typeAssure !== "AS" && !familleChoisie) { setErreur("Choisissez la famille d'accueil (conjoint/enfant)."); return; }
    setBeneficiairesForm((v) => [...v, {
      ...mini,
      familleId: mini.typeAssure !== "AS" && !familleChoisie?.refLocale ? familleChoisie?.id : undefined,
      familleRefLocale: mini.typeAssure !== "AS" && !!familleChoisie?.refLocale,
    }]);
    setMini(emptyMini());
    setFamilleChoisie(null);
    setErreur(null);
  };

  const retirerBeneficiaire = (i: number) => setBeneficiairesForm((v) => v.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!form.contratId) { setErreur("Sélectionnez un contrat."); return; }
    if (form.type === "Incorporation" && beneficiairesForm.length === 0) { setErreur("Ajoutez au moins un bénéficiaire à incorporer."); return; }
    if (form.type === "Retrait" && !form.assureId) { setErreur("Sélectionnez le bénéficiaire à retirer."); return; }
    try {
      setSubmitting(true);
      if (form.type === "Incorporation") {
        const demande = await createDemandeClient({
          contratId: form.contratId, type: "Incorporation", dateDemande: form.dateDemande,
          beneficiaires: beneficiairesForm.map(({ photoFile: _photoFile, ...rest }) => rest),
        });
        // Photos envoyées une fois les bénéficiaires créés (ids réels
        // connus) — même ordre que l'envoi, voir DemandesClientService.create.
        await Promise.all(
          beneficiairesForm.map((b, i) => {
            const cree = demande.beneficiaires[i];
            return b.photoFile && cree ? uploadPhotoBeneficiaireDemande(cree.id, b.photoFile).catch(() => undefined) : Promise.resolve();
          }),
        );
      } else {
        await createDemandeClient(form);
      }
      setShowCreate(false);
      refresh();
      toast.success("Demande envoyée — en attente de la décision du gestionnaire.");
    } catch (err) {
      if (err instanceof QueuedOfflineError) {
        // Pas une erreur : la demande est en file, elle partira seule à la
        // reconnexion (voir lib/syncManager.ts). Les photos jointes, elles,
        // ne peuvent pas être mises en file (fichier binaire) — à ajouter
        // une fois la demande effectivement créée côté serveur.
        setShowCreate(false);
        refresh();
        toast.info(
          beneficiairesForm.some((b) => b.photoFile)
            ? "Pas de connexion — la demande a été enregistrée et sera envoyée automatiquement. Vous pourrez ajouter les photos une fois la demande créée."
            : "Pas de connexion — la demande a été enregistrée et sera envoyée automatiquement dès le retour du réseau.",
        );
      } else {
        setErreur(err instanceof Error ? err.message : "Envoi impossible.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[1.35rem] font-bold text-foreground">Mes demandes</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Incorporations et retraits — soumis à validation du gestionnaire</p>
        </div>
        <Btn variant="primary" onClick={openCreate}><Plus className="w-4 h-4" />Nouvelle demande</Btn>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-left px-4 py-2.5">Bénéficiaire(s)</th>
              <th className="text-left px-4 py-2.5">Contrat</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-left px-4 py-2.5">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {demandes.map((d) => (
              <tr key={d.id} className="hover:bg-secondary/25">
                <td className="px-4 py-2.5 text-foreground flex items-center gap-1.5">
                  {d.type === "Incorporation" ? <UserPlus className="w-3.5 h-3.5 text-emerald-600" /> : <UserMinus className="w-3.5 h-3.5 text-amber-600" />}
                  {d.type}
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {d.type === "Incorporation" ? d.beneficiaires.map((b) => `${b.nom} ${b.prenom ?? ""}`.trim()).join(", ") || "—" : d.assureRetraitNom ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.contratReference ?? d.contratId}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.dateDemande}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={statutVariant(d.statut)}>{d.statut}</Badge>
                  {d.statut === "Refusée" && d.motifRefus && <p className="text-[10.5px] text-muted-foreground mt-1">{d.motifRefus}</p>}
                </td>
              </tr>
            ))}
            {demandes.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucune demande.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-[15px] font-semibold text-foreground">Nouvelle demande</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((v) => ({ ...v, type: "Incorporation" }))} className={`flex-1 h-10 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 ${form.type === "Incorporation" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <UserPlus className="w-4 h-4" />Incorporation
                </button>
                <button type="button" onClick={() => setForm((v) => ({ ...v, type: "Retrait" }))} className={`flex-1 h-10 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 ${form.type === "Retrait" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <UserMinus className="w-4 h-4" />Retrait
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <div className={labelCls}>Contrat concerné</div>
                  <Combobox
                    options={contrats}
                    value={contratChoisi}
                    onChange={(c) => { setContratChoisi(c); setForm((v) => ({ ...v, contratId: c?.id ?? "" })); }}
                    getLabel={(c) => c.numeroPolice ?? c.id}
                    getSubLabel={(c) => c.branche}
                    getId={(c) => c.id}
                    placeholder="Rechercher…"
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>Date de la demande</div>
                  <DateInput value={form.dateDemande} onChange={(v) => setForm((f) => ({ ...f, dateDemande: v }))} className={fieldCls} />
                </label>
              </div>

              {form.type === "Incorporation" ? (
                <div className="space-y-4">
                  {beneficiairesForm.length > 0 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                            <th className="text-left px-2.5 py-1.5">Bénéficiaire</th>
                            <th className="text-left px-2.5 py-1.5">Lien</th>
                            <th className="text-left px-2.5 py-1.5">Famille</th>
                            <th className="px-2.5 py-1.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {beneficiairesForm.map((b, i) => (
                            <tr key={i}>
                              <td className="px-2.5 py-1.5 text-foreground">
                                <div className="flex items-center gap-1.5">
                                  {b.photoFile ? <PhotoThumb file={b.photoFile} /> : <Camera className="w-3 h-3 text-muted-foreground/50" />}
                                  {b.nom} {b.prenom ?? ""}
                                </div>
                              </td>
                              <td className="px-2.5 py-1.5 text-foreground">{LABEL_TYPE[b.typeAssure]}</td>
                              <td className="px-2.5 py-1.5 text-muted-foreground">{b.typeAssure === "AS" ? "—" : (b.familleRefLocale ? "Nouvel assuré principal" : optionsFamille.find((o) => o.id === b.familleId)?.label.split(" (")[0] ?? "—")}</td>
                              <td className="px-2.5 py-1.5 text-right">
                                <button type="button" onClick={() => retirerBeneficiaire(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="bg-secondary/20 border border-border rounded-xl p-4 space-y-3">
                    <p className="text-[11.5px] font-medium text-foreground">Ajouter un bénéficiaire</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block">
                        <div className={labelCls}>Lien avec l'assuré</div>
                        <select value={mini.typeAssure} onChange={(e) => { setMini((v) => ({ ...v, typeAssure: e.target.value as BeneficiaireInput["typeAssure"] })); setFamilleChoisie(null); }} className={fieldCls}>
                          <option value="AS" disabled={!!asLocal}>Assuré principal</option>
                          <option value="CJ">Conjoint</option>
                          <option value="EF">Enfant</option>
                        </select>
                      </label>
                      {mini.typeAssure !== "AS" && (
                        <label className="block">
                          <div className={labelCls}>Famille d'accueil</div>
                          <Combobox
                            options={optionsFamille}
                            value={familleChoisie}
                            onChange={setFamilleChoisie}
                            getLabel={(o) => o.label}
                            getId={(o) => o.id}
                            placeholder={optionsFamille.length ? "Rechercher…" : "Choisissez d'abord un contrat"}
                            disabled={optionsFamille.length === 0}
                          />
                        </label>
                      )}
                      <label className="block"><div className={labelCls}>Nom</div><input value={mini.nom} onChange={(e) => setMini((v) => ({ ...v, nom: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className={labelCls}>Prénom</div><input value={mini.prenom ?? ""} onChange={(e) => setMini((v) => ({ ...v, prenom: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className={labelCls}>Date de naissance</div><DateInput value={mini.dateNaissance ?? ""} onChange={(v) => setMini((f) => ({ ...f, dateNaissance: v }))} className={fieldCls} /></label>
                      <label className="block">
                        <div className={labelCls}>Sexe</div>
                        <select value={mini.sexe ?? ""} onChange={(e) => setMini((v) => ({ ...v, sexe: e.target.value }))} className={fieldCls}>
                          <option value="">—</option>
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                        </select>
                      </label>
                      <label className="block"><div className={labelCls}>Téléphone</div><input value={mini.telephone ?? ""} onChange={(e) => setMini((v) => ({ ...v, telephone: e.target.value }))} className={fieldCls} /></label>
                      <label className="block"><div className={labelCls}>Adresse</div><input value={mini.adresse ?? ""} onChange={(e) => setMini((v) => ({ ...v, adresse: e.target.value }))} className={fieldCls} /></label>
                      <label className="block md:col-span-2">
                        <div className={labelCls}>Photo (pour la carte d'assurance)</div>
                        <div className="flex items-center gap-3">
                          {mini.photoFile ? (
                            <PhotoThumb file={mini.photoFile} size="w-14 h-14" />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              <Camera className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 space-y-1">
                            {/* Pas d'attribut `accept` (2026-09) — voir participants/index.tsx :
                                dépendre du type MIME détecté par l'OS s'est montré peu fiable
                                (masquait même des .png sur certains postes). */}
                            <input type="file" onChange={(e) => setMini((v) => ({ ...v, photoFile: e.target.files?.[0] }))} className={`${fieldCls} py-1.5`} />
                            {mini.photoFile && (
                              <button type="button" onClick={() => setMini((v) => ({ ...v, photoFile: undefined }))} className="text-[11px] text-muted-foreground hover:text-destructive">Retirer la photo</button>
                            )}
                          </div>
                        </div>
                      </label>
                    </div>
                    <Btn variant="secondary" onClick={ajouterBeneficiaire}><Plus className="w-4 h-4" />Ajouter à la liste</Btn>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <div className={labelCls}>Bénéficiaire à retirer</div>
                    <Combobox
                      options={participants}
                      value={assureChoisi}
                      onChange={(a) => { setAssureChoisi(a); setForm((v) => ({ ...v, assureId: a?.id ?? "" })); }}
                      getLabel={(a) => `${a.nom} ${a.prenom ?? ""}`}
                      getSubLabel={(a) => a.matricule}
                      getId={(a) => a.id}
                      disabled={!form.contratId}
                      placeholder={form.contratId ? "Rechercher…" : "Choisissez d'abord un contrat"}
                    />
                  </label>
                  <label className="block"><div className={labelCls}>Motif du retrait</div><input value={form.motifRetrait ?? ""} onChange={(e) => setForm((v) => ({ ...v, motifRetrait: e.target.value }))} className={fieldCls} placeholder="ex. Départ de l'entreprise" /></label>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex items-center justify-between">
              <div className="text-[12px] text-destructive">{erreur ?? ""}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Annuler</button>
                <button type="button" disabled={submitting} onClick={submit} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] hover:opacity-90 disabled:opacity-60">Envoyer la demande</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
