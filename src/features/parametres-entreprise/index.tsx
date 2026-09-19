import { useEffect, useState } from "react";
import { Palette, Save, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import {
  getParametresEntreprise, updateParametresEntreprise, logoEntrepriseUrl, uploadLogoEntreprise, deleteLogoEntreprise,
  pageGardeStatistiquesUrl, uploadPageGardeStatistiques, deletePageGardeStatistiques,
} from "@/services/parametresEntreprise.service";
import { getModelesCarte } from "@/services/modelesCarte.service";
import type { ParametresEntreprise } from "@/types/parametresEntreprise";
import type { ModeleCarte } from "@/types/modeleCarte";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";
const labelCls = "text-[12px] text-muted-foreground mb-1.5";

export default function ParametresEntrepriseView() {
  const [form, setForm] = useState<ParametresEntreprise | null>(null);
  const [saving, setSaving] = useState(false);
  const [modeles, setModeles] = useState<ModeleCarte[]>([]);
  const [logoBusy, setLogoBusy] = useState(false);
  const [pageGardeBusy, setPageGardeBusy] = useState(false);

  useEffect(() => {
    getParametresEntreprise().then(setForm);
    getModelesCarte().then(setModeles).catch(() => undefined);
  }, []);

  const handleSave = async () => {
    if (!form) return;
    try {
      setSaving(true);
      const saved = await updateParametresEntreprise(form);
      setForm(saved);
      toast.success("Paramètres enregistrés — appliqués aux prochains documents et cartes générés.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    try {
      setLogoBusy(true);
      const maj = await uploadLogoEntreprise(file);
      setForm(maj);
      toast.success("Logo mis à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi du logo impossible.");
    } finally {
      setLogoBusy(false);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      setLogoBusy(true);
      const maj = await deleteLogoEntreprise();
      setForm(maj);
      toast.success("Logo supprimé.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setLogoBusy(false);
    }
  };

  const handleUploadPageGarde = async (file: File) => {
    try {
      setPageGardeBusy(true);
      const maj = await uploadPageGardeStatistiques(file);
      setForm(maj);
      toast.success("Page de garde mise à jour.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi de la page de garde impossible.");
    } finally {
      setPageGardeBusy(false);
    }
  };

  const handleDeletePageGarde = async () => {
    try {
      setPageGardeBusy(true);
      const maj = await deletePageGardeStatistiques();
      setForm(maj);
      toast.success("Page de garde supprimée — le rapport revient à la mise en page par défaut.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setPageGardeBusy(false);
    }
  };

  if (!form) return null;
  const set = <K extends keyof ParametresEntreprise>(key: K, value: ParametresEntreprise[K]) => setForm((v) => (v ? { ...v, [key]: value } : v));

  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <ModuleHeader
        title="Paramètres de l'entreprise"
        subtitle="Identité, coordonnées et couleurs utilisées dans les quittances, avenants, tableaux de garanties et cartes d'assurance générés — personnalisables pour chaque courtier ou compagnie qui exploite l'application."
        icon={Palette}
        actions={<Btn variant="primary" disabled={saving} onClick={handleSave}><Save className="w-4 h-4" />Enregistrer</Btn>}
      />

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Identité</h3>
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
          <div>
            <div className={labelCls}>Logo</div>
            <div className="border border-border rounded-lg p-2.5 space-y-2">
              <div className="w-full aspect-square rounded-lg overflow-hidden bg-secondary/40 flex items-center justify-center">
                {logoEntrepriseUrl(form.logo)
                  ? <img src={logoEntrepriseUrl(form.logo)} alt="" className="w-full h-full object-contain bg-white" />
                  : <Building2 className="w-8 h-8 text-muted-foreground" />}
              </div>
              <label className="block">
                <input type="file" accept="image/*" className="hidden" disabled={logoBusy} onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) handleUploadLogo(file);
                }} />
                <span className="block text-center h-8 leading-8 rounded-lg bg-emerald-600 text-white text-[11.5px] font-medium cursor-pointer hover:opacity-90">+ Télécharger</span>
              </label>
              {form.logo && (
                <button type="button" onClick={handleDeleteLogo} disabled={logoBusy} className="w-full h-8 rounded-lg bg-destructive text-destructive-foreground text-[11.5px] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3 h-3" />Supprimer
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-1.5">Remonte sur les quittances, courriers, prises en charge, factures, règlements et cartes d'assurance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <div className={labelCls}>Nom (courtier / compagnie)</div>
              <input value={form.nom} onChange={(e) => set("nom", e.target.value)} className={fieldCls} placeholder="ex: MedAssur" />
            </label>
            <label className="block">
              <div className={labelCls}>Sous-titre</div>
              <input value={form.sousTitre} onChange={(e) => set("sousTitre", e.target.value)} className={fieldCls} placeholder="ex: Courtier d'Assurances" />
            </label>
            <label className="block">
              <div className={labelCls}>Code agence</div>
              <input value={form.codeAgence ?? ""} onChange={(e) => set("codeAgence", e.target.value)} className={fieldCls} placeholder="ex: 001" />
            </label>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Coordonnées</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block md:col-span-2">
            <div className={labelCls}>Adresse</div>
            <input value={form.adresse ?? ""} onChange={(e) => set("adresse", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Boîte postale</div>
            <input value={form.boitePostale} onChange={(e) => set("boitePostale", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Ville</div>
            <input value={form.ville} onChange={(e) => set("ville", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Pays</div>
            <input value={form.pays} onChange={(e) => set("pays", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Téléphone</div>
            <input value={form.telephone} onChange={(e) => set("telephone", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Email</div>
            <input value={form.email} onChange={(e) => set("email", e.target.value)} className={fieldCls} />
          </label>
          <label className="block">
            <div className={labelCls}>Site web</div>
            <input value={form.siteWeb} onChange={(e) => set("siteWeb", e.target.value)} className={fieldCls} />
          </label>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Couleurs</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className={labelCls}>Couleur primaire</div>
            <div className="flex items-center gap-2">
              <input type="color" value={form.couleurPrimaire} onChange={(e) => set("couleurPrimaire", e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-background" />
              <input value={form.couleurPrimaire} onChange={(e) => set("couleurPrimaire", e.target.value)} className={fieldCls} />
            </div>
          </label>
          <label className="block">
            <div className={labelCls}>Couleur secondaire</div>
            <div className="flex items-center gap-2">
              <input type="color" value={form.couleurSecondaire} onChange={(e) => set("couleurSecondaire", e.target.value)} className="h-9 w-12 rounded-lg border border-border bg-background" />
              <input value={form.couleurSecondaire} onChange={(e) => set("couleurSecondaire", e.target.value)} className={fieldCls} />
            </div>
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">Utilisées pour les bandeaux, titres et accents des quittances, avenants, tableaux de garanties et cartes d'assurance santé.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Carte d'assurance & matricule</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className={labelCls}>Modèle de carte</div>
            <select value={form.modeleCarteId ?? "classique"} onChange={(e) => set("modeleCarteId", e.target.value === "classique" ? null : e.target.value)} className={fieldCls}>
              {modeles.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
            </select>
          </label>
          <label className="block">
            <div className={labelCls}>Préfixe matricule</div>
            <input value={form.prefixeMatricule ?? ""} onChange={(e) => set("prefixeMatricule", e.target.value.toUpperCase())} className={fieldCls} placeholder="ex: LRX" />
            <p className="text-[10.5px] text-muted-foreground mt-1">Matricule auto-généré du prochain assuré : {(form.prefixeMatricule || "MAT").toUpperCase()}-00000A. Vide = préfixe générique historique.</p>
          </label>
        </div>
        {/* Texte du verso éditable (2026-09) — voir demande utilisateur :
            "il faudrait que l'application puisse générer ces deux blocs de
            texte au lieu de les laisser figés... éditables afin qu'on
            puisse changer les informations à tout moment." Uniquement
            utile si un modèle de carte importé (avec image de verso) est
            choisi ci-dessus — superposé au fond, vide = fond tel quel. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <div className={labelCls}>Texte d'introduction (verso)</div>
            <textarea
              value={form.carteVersoIntro ?? ""}
              onChange={(e) => set("carteVersoIntro", e.target.value)}
              className={`${fieldCls} min-h-[72px] resize-y`}
              placeholder={`Cette carte est strictement personnelle et vous permet de vous identifier auprès du réseau agréé ${form.nom || "…"} par les moyens suivants:`}
            />
            <p className="text-[10.5px] text-muted-foreground mt-1">Superposé au verso du modèle de carte choisi (si celui-ci porte une image). Vide = verso importé inchangé.</p>
          </label>
          <label className="block">
            <div className={labelCls}>Numéro d'assistance (verso)</div>
            <input
              value={form.carteVersoTelephone ?? ""}
              onChange={(e) => set("carteVersoTelephone", e.target.value)}
              className={fieldCls}
              placeholder="ex: (+241) 62 55 55 79 (Numéro d'assistance)"
            />
          </label>
          <label className="block md:col-span-2">
            <div className={labelCls}>Explication du QR Code (verso)</div>
            <textarea
              value={form.carteVersoQrExplication ?? ""}
              onChange={(e) => set("carteVersoQrExplication", e.target.value)}
              className={`${fieldCls} min-h-[56px] resize-y`}
              placeholder="Contact direct du professionnel santé agréé de votre choix qui scanne le QR Code et demande une prise en charge pour vos soins."
            />
          </label>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-foreground">Rapport Statistiques — page de garde</h3>
        <p className="text-[11px] text-muted-foreground -mt-2">
          Le corps du rapport (tableaux, graphiques) est identique pour tous — seule la page de garde (1ère page) est personnalisable. Importez une image pleine page (portrait, format A4) : votre logo, vos coordonnées et vos couleurs y apparaîtront, le client, le numéro de police et la période sont ajoutés automatiquement par-dessus.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
          <div>
            <div className="border border-border rounded-lg p-2.5 space-y-2">
              <div className="w-full aspect-[210/297] rounded-lg overflow-hidden bg-secondary/40 flex items-center justify-center">
                {pageGardeStatistiquesUrl(form.statistiquesPageGarde)
                  ? <img src={pageGardeStatistiquesUrl(form.statistiquesPageGarde)} alt="" className="w-full h-full object-cover" />
                  : <Palette className="w-8 h-8 text-muted-foreground" />}
              </div>
              <label className="block">
                <input type="file" accept="image/*" className="hidden" disabled={pageGardeBusy} onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file) handleUploadPageGarde(file);
                }} />
                <span className="block text-center h-8 leading-8 rounded-lg bg-emerald-600 text-white text-[11.5px] font-medium cursor-pointer hover:opacity-90">+ Télécharger</span>
              </label>
              {form.statistiquesPageGarde && (
                <button type="button" onClick={handleDeletePageGarde} disabled={pageGardeBusy} className="w-full h-8 rounded-lg bg-destructive text-destructive-foreground text-[11.5px] font-medium hover:opacity-90 inline-flex items-center justify-center gap-1.5">
                  <Trash2 className="w-3 h-3" />Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
