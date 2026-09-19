import { useState } from "react";
import { Download, Upload, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";

// Import en masse générique (2026-08) — modèle .xlsx téléchargeable,
// aperçu (dry-run, lecture seule — pour corriger une ligne, on l'ajuste
// dans le tableur puis on réimporte le fichier) puis confirmation en
// second appel. Réutilisé par Souscripteurs, Contrats, Assurés, Factures,
// Règlements et Prises en charge (voir demande utilisateur : "créer 50,
// 100, 1000 contrats" impraticable un par un).
//
// Volumétrie 50 000+ lignes (2026-09 — voir demande utilisateur : "chaque
// import puisse générer une écriture de plus de 50000 lignes... sans
// planter le système") — deux protections, toutes deux dans CE composant
// partagé (donc valables pour les 6 imports qui le réutilisent, pas
// seulement Factures) :
// 1. Le tableau d'aperçu n'affiche jamais plus de PLAFOND_LIGNES_AFFICHEES
//    lignes (un <table> React de 50 000 <tr> gèlerait/planterait
//    l'onglet du navigateur) — la totalité reste néanmoins bien envoyée à
//    la confirmation, seul l'AFFICHAGE est plafonné.
// 2. La confirmation part en LOTS (TAILLE_LOT) plutôt qu'en une seule
//    requête géante — évite un body/timeout démesuré et donne une
//    progression visible ; les numéros de ligne des rejets sont recalés
//    sur l'index global (pas l'index local au lot).
const PLAFOND_LIGNES_AFFICHEES = 200;
const PLAFOND_REJETS_AFFICHES = 150;
const TAILLE_LOT = 1000;
export function ImportEnMasseModal<Row>({
  titre, onClose, onImported, telechargerModele, apercu, confirmer, colonnes,
}: {
  titre: string;
  onClose: () => void;
  onImported: () => void;
  telechargerModele: () => Promise<void>;
  apercu: (file: File) => Promise<{ lignes: Row[]; rejets: { ligne: number; motif: string }[] }>;
  confirmer: (rows: Row[]) => Promise<{ crees: number; rejets: { ligne: number; motif: string }[] }>;
  colonnes: { key: keyof Row; label: string }[];
}) {
  const [chargementModele, setChargementModele] = useState(false);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [chargementApercu, setChargementApercu] = useState(false);
  const [resultatApercu, setResultatApercu] = useState<{ lignes: Row[]; rejets: { ligne: number; motif: string }[] } | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);
  const [resultatConfirmation, setResultatConfirmation] = useState<{ crees: number; rejets: { ligne: number; motif: string }[] } | null>(null);

  const handleTelechargerModele = async () => {
    setChargementModele(true);
    try {
      await telechargerModele();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible.");
    } finally {
      setChargementModele(false);
    }
  };

  const handleFichier = async (file: File) => {
    setNomFichier(file.name);
    setResultatApercu(null);
    setResultatConfirmation(null);
    setChargementApercu(true);
    try {
      setResultatApercu(await apercu(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lecture du fichier impossible.");
    } finally {
      setChargementApercu(false);
    }
  };

  const handleConfirmer = async () => {
    if (!resultatApercu) return;
    setConfirmation(true);
    setProgression({ fait: 0, total: resultatApercu.lignes.length });
    try {
      // Envoi par lots (voir commentaire d'en-tête) — une seule requête pour
      // un petit fichier (1 lot), plusieurs requêtes séquentielles pour un
      // gros. Les numéros de ligne des rejets sont recalés sur l'offset du
      // lot pour rester lisibles (voir `r.ligne + offset`).
      let crees = 0;
      const rejets: { ligne: number; motif: string }[] = [];
      for (let offset = 0; offset < resultatApercu.lignes.length; offset += TAILLE_LOT) {
        const lot = resultatApercu.lignes.slice(offset, offset + TAILLE_LOT);
        const res = await confirmer(lot);
        crees += res.crees;
        for (const r of res.rejets) rejets.push({ ligne: r.ligne + offset, motif: r.motif });
        setProgression({ fait: Math.min(offset + lot.length, resultatApercu.lignes.length), total: resultatApercu.lignes.length });
      }
      setResultatConfirmation({ crees, rejets });
      if (crees > 0) { toast.success(`${crees} ligne(s) importée(s).`); onImported(); }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setConfirmation(false);
      setProgression(null);
    }
  };

  const lignesValides = resultatApercu ? resultatApercu.lignes.length - resultatApercu.rejets.length : 0;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h3 className="text-[15px] font-semibold text-foreground">{titre}</h3>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          <div className="rounded-xl border border-border p-4">
            <p className="text-[13px] font-semibold text-foreground mb-1">1. Télécharger le modèle</p>
            <p className="text-[12px] text-muted-foreground mb-3">Remplissez-le (une ligne par enregistrement), puis chargez-le ci-dessous.</p>
            <Btn variant="secondary" disabled={chargementModele} onClick={handleTelechargerModele}><Download className="w-4 h-4" />Télécharger le modèle .xlsx</Btn>
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-[13px] font-semibold text-foreground mb-1">2. Charger le fichier rempli</p>
            <p className="text-[12px] text-muted-foreground mb-3">Un aperçu s'affiche avant tout enregistrement — corrigez une ligne dans le fichier puis rechargez-le si besoin.</p>
            <label className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 cursor-pointer">
              <Upload className="w-4 h-4" />{nomFichier ?? "Choisir un fichier .xlsx"}
              <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFichier(f); }} />
            </label>
            {chargementApercu && <p className="text-[12px] text-muted-foreground mt-2">Lecture du fichier…</p>}
          </div>

          {resultatApercu && (
            <div className="rounded-xl border border-border p-4">
              <p className="text-[13px] font-semibold text-foreground mb-2">
                Aperçu — {resultatApercu.lignes.length} ligne(s) lue(s), {lignesValides} prête(s) à importer
                {resultatApercu.rejets.length > 0 && <span className="text-amber-600"> · {resultatApercu.rejets.length} à corriger</span>}
              </p>
              {resultatApercu.rejets.length > 0 && (
                <div className="mb-3 space-y-1">
                  {resultatApercu.rejets.slice(0, PLAFOND_REJETS_AFFICHES).map((r, i) => (
                    <p key={i} className="text-[11.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />Ligne {r.ligne} : {r.motif}
                    </p>
                  ))}
                  {resultatApercu.rejets.length > PLAFOND_REJETS_AFFICHES && (
                    <p className="text-[11.5px] text-muted-foreground px-1">+ {resultatApercu.rejets.length - PLAFOND_REJETS_AFFICHES} autre(s) ligne(s) à corriger — non affichée(s) ci-dessus.</p>
                  )}
                </div>
              )}
              <div className="border border-border rounded-lg overflow-x-auto max-h-64">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-secondary/40 sticky top-0">
                      {colonnes.map((c) => <th key={String(c.key)} className="text-left px-2.5 py-1.5 whitespace-nowrap">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {resultatApercu.lignes.slice(0, PLAFOND_LIGNES_AFFICHEES).map((ligne, i) => (
                      <tr key={i}>
                        {colonnes.map((c) => <td key={String(c.key)} className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{String(ligne[c.key] ?? "—")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {resultatApercu.lignes.length > PLAFOND_LIGNES_AFFICHEES && (
                <p className="text-[11.5px] text-muted-foreground mt-1.5">
                  Aperçu limité aux {PLAFOND_LIGNES_AFFICHEES} premières lignes pour rester fluide — les {resultatApercu.lignes.length - PLAFOND_LIGNES_AFFICHEES} lignes restantes sont bien prises en compte à la confirmation.
                </p>
              )}
              <div className="mt-3">
                <Btn variant="primary" disabled={confirmation || lignesValides === 0} onClick={handleConfirmer}>
                  <CheckCircle2 className="w-4 h-4" />
                  {confirmation ? "Import en cours…" : `Confirmer l'import (${lignesValides})`}
                </Btn>
                {confirmation && progression && progression.total > TAILLE_LOT && (
                  <p className="text-[11.5px] text-muted-foreground mt-2">
                    {progression.fait} / {progression.total} ligne(s) traitée(s)…
                  </p>
                )}
              </div>
            </div>
          )}

          {resultatConfirmation && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-[13px] font-semibold text-foreground">{resultatConfirmation.crees} ligne(s) importée(s) avec succès.</p>
              {resultatConfirmation.rejets.length > 0 && (
                <div className="mt-2 space-y-1">
                  {resultatConfirmation.rejets.slice(0, PLAFOND_REJETS_AFFICHES).map((r, i) => (
                    <p key={i} className="text-[11.5px] text-destructive">Ligne {r.ligne} : {r.motif}</p>
                  ))}
                  {resultatConfirmation.rejets.length > PLAFOND_REJETS_AFFICHES && (
                    <p className="text-[11.5px] text-muted-foreground">+ {resultatConfirmation.rejets.length - PLAFOND_REJETS_AFFICHES} autre(s) ligne(s) rejetée(s) — non affichée(s) ci-dessus.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex justify-end">
          <Btn variant="secondary" onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
}
