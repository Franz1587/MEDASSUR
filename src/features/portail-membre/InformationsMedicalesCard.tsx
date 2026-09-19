import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Pencil, Save, X, Plus } from "lucide-react";
import { getMoi, modifierInformationsMedicales, type MembreIdentite } from "@/services/portailMembre.service";
import { QueuedOfflineError } from "@/lib/http";

// Informations médicales d'urgence, dans l'E-carnet Santé (2026-09) — fiche
// santé auto-déclarative (groupe sanguin, allergies, antécédents,
// traitements en cours, contact d'urgence), affichée en évidence en haut de
// l'écran. Même endpoint que l'application mobile MEDASSUR
// (PATCH /portail-membre/informations-medicales) — aucun décalage entre les
// deux versions. Cette fiche ne doit JAMAIS être nommée avec un nom de
// produit concurrent nulle part sur la plateforme — voir demande
// utilisateur explicite. "E-carnet Santé" reste le seul nom d'écran.
function ListeModifiable({ titre, valeurs, onChange, placeholder }: { titre: string; valeurs: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [saisie, setSaisie] = useState("");
  const ajouter = () => {
    const v = saisie.trim();
    if (!v) return;
    onChange([...valeurs, v]);
    setSaisie("");
  };
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-muted-foreground mb-1.5">{titre}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {valeurs.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full bg-secondary/60 text-[12px] text-foreground">
            {v}
            <button type="button" onClick={() => onChange(valeurs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {valeurs.length === 0 && <span className="text-[12px] text-muted-foreground italic">Aucun renseigné.</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={saisie} onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
          placeholder={placeholder}
          className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-[12px] text-foreground"
        />
        <button type="button" onClick={ajouter} className="h-8 w-8 rounded-lg border border-border text-foreground hover:bg-secondary/40 inline-flex items-center justify-center flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function InformationsMedicalesCard() {
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [edition, setEdition] = useState(false);
  const [saving, setSaving] = useState(false);

  const [groupeSanguin, setGroupeSanguin] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [antecedentsMedicaux, setAntecedentsMedicaux] = useState<string[]>([]);
  const [traitementsEnCours, setTraitementsEnCours] = useState<string[]>([]);
  const [contactUrgenceNom, setContactUrgenceNom] = useState("");
  const [contactUrgenceTelephone, setContactUrgenceTelephone] = useState("");

  const chargerDepuis = (m: MembreIdentite) => {
    setMoi(m);
    setGroupeSanguin(m.groupeSanguin ?? "");
    setAllergies(m.allergies ?? []);
    setAntecedentsMedicaux(m.antecedentsMedicaux ?? []);
    setTraitementsEnCours(m.traitementsEnCours ?? []);
    setContactUrgenceNom(m.contactUrgenceNom ?? "");
    setContactUrgenceTelephone(m.contactUrgenceTelephone ?? "");
  };

  useEffect(() => { getMoi().then(chargerDepuis).catch(() => undefined); }, []);

  const enregistrer = async () => {
    setSaving(true);
    const saisie = {
      groupeSanguin: groupeSanguin.trim() || undefined,
      allergies, antecedentsMedicaux, traitementsEnCours,
      contactUrgenceNom: contactUrgenceNom.trim() || undefined,
      contactUrgenceTelephone: contactUrgenceTelephone.trim() || undefined,
    };
    try {
      const m = await modifierInformationsMedicales(saisie);
      chargerDepuis(m);
      setEdition(false);
      toast.success("Informations médicales mises à jour.");
    } catch (err) {
      if (err instanceof QueuedOfflineError) {
        // Pas une erreur : mis en file, sera envoyé seul à la reconnexion
        // (voir lib/syncManager.ts) — on affiche déjà la saisie localement
        // plutôt que d'attendre l'écho du serveur.
        setMoi((prev) => (prev ? { ...prev, ...saisie } : prev));
        setEdition(false);
        toast.info("Pas de connexion — enregistré localement, sera envoyé dès le retour du réseau.");
      } else {
        toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
      }
    } finally {
      setSaving(false);
    }
  };

  const annuler = () => {
    if (moi) chargerDepuis(moi);
    setEdition(false);
  };

  if (!moi) return null;

  const rienRenseigne = !moi.groupeSanguin && !moi.allergies?.length && !moi.antecedentsMedicaux?.length
    && !moi.traitementsEnCours?.length && !moi.contactUrgenceNom;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-semibold text-foreground flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-primary" />Informations médicales
        </p>
        {!edition ? (
          <button type="button" onClick={() => setEdition(true)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" />{rienRenseigne ? "Renseigner" : "Modifier"}
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button type="button" onClick={annuler} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Annuler</button>
            <button type="button" onClick={enregistrer} disabled={saving} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />{saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground -mt-2">
        Fiche d'urgence consultable rapidement (par vous, ou par un tiers habilité en cas d'urgence) — renseignée par vous-même, jamais déduite.
      </p>

      {!edition ? (
        rienRenseigne ? (
          <p className="text-[12.5px] text-muted-foreground italic">Aucune information renseignée pour l'instant.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12.5px]">
            <div><span className="text-muted-foreground">Groupe sanguin : </span><span className="font-medium text-foreground">{moi.groupeSanguin || "—"}</span></div>
            <div><span className="text-muted-foreground">Contact d'urgence : </span><span className="font-medium text-foreground">{moi.contactUrgenceNom ? `${moi.contactUrgenceNom}${moi.contactUrgenceTelephone ? " · " + moi.contactUrgenceTelephone : ""}` : "—"}</span></div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Allergies : </span>
              <span className="font-medium text-foreground">{moi.allergies?.length ? moi.allergies.join(", ") : "Aucune renseignée"}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Antécédents médicaux : </span>
              <span className="font-medium text-foreground">{moi.antecedentsMedicaux?.length ? moi.antecedentsMedicaux.join(", ") : "Aucun renseigné"}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Traitements en cours : </span>
              <span className="font-medium text-foreground">{moi.traitementsEnCours?.length ? moi.traitementsEnCours.join(", ") : "Aucun renseigné"}</span>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-[11.5px] text-muted-foreground mb-1">Groupe sanguin</div>
              <input value={groupeSanguin} onChange={(e) => setGroupeSanguin(e.target.value)} placeholder="ex. O+" className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
            </label>
            <label className="block">
              <div className="text-[11.5px] text-muted-foreground mb-1">Contact d'urgence — téléphone</div>
              <input value={contactUrgenceTelephone} onChange={(e) => setContactUrgenceTelephone(e.target.value)} placeholder="+241 …" className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
            </label>
            <label className="block sm:col-span-2">
              <div className="text-[11.5px] text-muted-foreground mb-1">Contact d'urgence — nom</div>
              <input value={contactUrgenceNom} onChange={(e) => setContactUrgenceNom(e.target.value)} placeholder="Nom du proche à contacter" className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
            </label>
          </div>
          <ListeModifiable titre="Allergies" valeurs={allergies} onChange={setAllergies} placeholder="ex. Pénicilline — Entrée pour ajouter" />
          <ListeModifiable titre="Antécédents médicaux" valeurs={antecedentsMedicaux} onChange={setAntecedentsMedicaux} placeholder="ex. Diabète type 2 — Entrée pour ajouter" />
          <ListeModifiable titre="Traitements en cours" valeurs={traitementsEnCours} onChange={setTraitementsEnCours} placeholder="ex. Metformine 500mg — Entrée pour ajouter" />
        </div>
      )}
    </div>
  );
}
