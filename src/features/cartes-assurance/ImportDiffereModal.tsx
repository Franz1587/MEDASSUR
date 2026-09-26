import { useEffect, useState } from "react";
import { X, FolderOpen, FileDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import { Combobox } from "@/components/shared/Combobox";
import { getContrats } from "@/services/contrats.service";
import {
  readPopulationFile, importPopulation, uploadAssurePhoto, downloadPopulationTemplateContrat,
  type ImportPopulationResult,
} from "@/services/sante.service";
import type { Contrat } from "@/types/contrats";
import { numeroPolice } from "@/lib/police";

const fieldCls = "w-full border border-border rounded-lg px-3 py-2 bg-background text-[13px] text-foreground";

// Même format que ContratsView (parseImportRows) — dupliqué volontairement
// en version minimale ici : cet écran n'a pas besoin de l'aperçu éditable
// famille par famille, seulement des colonnes Matricule/Téléphone/Photo
// pour retrouver la personne déjà affiliée et compléter ses informations.
interface LigneImportDiffere {
  matricule: string;
  nom: string;
  prenom: string;
  sexe: string;
  dateNaissance: string;
  typeAssure: string;
  telephone: string;
  photo: string;
}

function splitNomPrenom(full: string): { nom: string; prenom: string } {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { nom: "", prenom: "" };
  const isAllCaps = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
  let i = 0;
  while (i < words.length && isAllCaps(words[i])) i++;
  if (i === 0) i = 1;
  if (i >= words.length) i = Math.max(1, words.length - 1);
  return { nom: words.slice(0, i).join(" "), prenom: words.slice(i).join(" ") };
}

function parseLignes(csv: string): LigneImportDiffere[] {
  const lines = csv.split(/\r\n|\r|\n/).slice(1);
  return lines
    .map((line) => line.split(";"))
    .filter((cells) => !!cells[1]?.trim())
    .map((cells) => {
      const { nom, prenom } = splitNomPrenom(cells[1] ?? "");
      return {
        matricule: (cells[0] ?? "").trim(),
        nom, prenom,
        dateNaissance: (cells[3] ?? "").trim(),
        sexe: (cells[4] ?? "").trim().toUpperCase(),
        typeAssure: (cells[5] ?? "").trim().toUpperCase(),
        telephone: (cells[11] ?? "").trim(),
        photo: (cells[12] ?? "").trim(),
      };
    });
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportDiffereModal({ onClose, onImported }: Props) {
  const [contrats, setContrats] = useState<Contrat[]>([]);
  const [contratId, setContratId] = useState("");
  const [dossier, setDossier] = useState<{ nomCsv: string; lignes: LigneImportDiffere[]; photos: Map<string, File> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultat, setResultat] = useState<ImportPopulationResult | null>(null);
  const [photosEchouees, setPhotosEchouees] = useState<{ matricule: string; motif: string }[]>([]);
  const [photosReussies, setPhotosReussies] = useState(0);
  const [telechargementModele, setTelechargementModele] = useState(false);

  useEffect(() => { getContrats().then(setContrats); }, []);

  const handleTelechargerModele = async () => {
    if (!contratId) return;
    try {
      setTelechargementModele(true);
      const n = await downloadPopulationTemplateContrat(contratId, contrats.find((c) => c.id === contratId)?.numeroPolice);
      if (n === 0) toast.success("Toutes les personnes de ce contrat ont déjà une photo et un téléphone — rien à compléter.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de générer le modèle.");
    } finally {
      setTelechargementModele(false);
    }
  };

  const handleDossierSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const liste = Array.from(files);
    const csvFile = liste.find((f) => /\.csv$/i.test(f.name));
    if (!csvFile) {
      toast.error("Aucun fichier .csv trouvé dans le dossier sélectionné.");
      return;
    }
    const buffer = await csvFile.arrayBuffer();
    const contenu = new TextDecoder("windows-1252").decode(buffer);
    const lignes = parseLignes(contenu);
    if (lignes.length === 0) {
      toast.error("Aucune ligne exploitable dans le fichier CSV du dossier.");
      return;
    }
    const photos = new Map<string, File>();
    for (const f of liste) {
      if (f !== csvFile) photos.set(f.name.toLowerCase(), f);
    }
    setDossier({ nomCsv: csvFile.name, lignes, photos });
    setResultat(null);
    setPhotosEchouees([]);
    setPhotosReussies(0);
    toast.success(`${lignes.length} ligne(s) détectée(s) dans ${csvFile.name} — ${photos.size} autre(s) fichier(s) (photos) trouvé(s) dans le dossier.`);
  };

  const handleImporter = async () => {
    if (!contratId || !dossier) return;
    try {
      setBusy(true);
      const rows = dossier.lignes.map((l) => ({
        matricule: l.matricule, nom: l.nom, prenom: l.prenom, sexe: l.sexe,
        dateNaissance: l.dateNaissance, typeAssure: l.typeAssure, telephone: l.telephone,
      }));
      const res = await importPopulation(contratId, rows);
      setResultat(res);

      // Photos : pour chaque ligne acceptée dont la colonne Photo correspond
      // à un fichier réellement présent dans le dossier sélectionné, upload
      // individuel (une erreur n'annule pas les autres).
      const idParMatricule = new Map(res.resultats.map((r) => [r.matricule, r.id]));
      let ok = 0;
      const echecs: { matricule: string; motif: string }[] = [];
      for (const ligne of dossier.lignes) {
        if (!ligne.photo) continue;
        const fichier = dossier.photos.get(ligne.photo.toLowerCase());
        if (!fichier) { echecs.push({ matricule: ligne.matricule, motif: `Fichier "${ligne.photo}" introuvable dans le dossier sélectionné.` }); continue; }
        const id = idParMatricule.get(ligne.matricule) ?? res.resultats.find((r) => r.matricule === ligne.matricule)?.id;
        if (!id) { echecs.push({ matricule: ligne.matricule, motif: "Ligne rejetée à l'import — photo non associée." }); continue; }
        try {
          await uploadAssurePhoto(id, fichier);
          ok++;
        } catch (err) {
          echecs.push({ matricule: ligne.matricule, motif: err instanceof Error ? err.message : "Échec de l'envoi de la photo." });
        }
      }
      setPhotosReussies(ok);
      setPhotosEchouees(echecs);
      toast.success(`Import terminé : ${res.imported} créé(s), ${res.updated} mis à jour, ${res.rejected.length} rejeté(s)${ok ? `, ${ok} photo(s) ajoutée(s)` : ""}.`);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Import différé — photos &amp; téléphones</h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">Complète une population déjà affiliée (aucune duplication : les lignes sont retrouvées par matricule).</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Fermer</button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <div className="text-[12px] text-muted-foreground mb-1.5">Contrat</div>
            <Combobox
              options={contrats}
              value={contrats.find((c) => c.id === contratId) ?? null}
              onChange={(c) => setContratId(c?.id ?? "")}
              getLabel={(c) => numeroPolice(c)} getSubLabel={(c) => c.client} getId={(c) => c.id}
              placeholder="Rechercher…"
            />
          </label>

          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Dossier (tableur + photos)</div>
            <button
              type="button"
              onClick={handleTelechargerModele}
              disabled={!contratId || telechargementModele}
              title={!contratId ? "Sélectionnez d'abord un contrat" : undefined}
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
            >
              <FileDown className="w-3.5 h-3.5" />{telechargementModele ? "Génération…" : "Télécharger le modèle"}
            </button>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg py-6 text-[12px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer">
            <FolderOpen className="w-5 h-5" />
            {dossier ? `${dossier.nomCsv} — ${dossier.lignes.length} ligne(s), ${dossier.photos.size} photo(s)` : "Sélectionner le dossier contenant le tableur (.csv) et les photos"}
            <input
              type="file"
              className="hidden"
              // webkitdirectory n'est pas typé par React — attribut posé via ref.
              ref={(el) => { if (el) el.setAttribute("webkitdirectory", "true"); }}
              multiple
              onChange={(e) => handleDossierSelect(e.target.files)}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Une fois le contrat choisi, "Télécharger le modèle" exporte uniquement les personnes à qui il manque encore une photo, un téléphone, ou les deux — les informations déjà connues sont pré-remplies, il ne reste qu'à compléter ce qui manque. Le fichier tableur doit rester dans le même dossier que les photos référencées en colonne "Photo" (nom de fichier avec extension, ex: "jean-ndong.jpg").
          </p>

          {resultat && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="px-3 py-2.5 bg-secondary/25 border-b border-border text-[12px] text-foreground">
                <span className="font-semibold">{resultat.imported}</span> créé(s) · <span className="font-semibold">{resultat.updated}</span> mis à jour ·{" "}
                <span className={resultat.rejected.length ? "font-semibold text-destructive" : "font-semibold"}>{resultat.rejected.length}</span> rejeté(s)
                {(photosReussies > 0 || photosEchouees.length > 0) && (
                  <> · <span className="font-semibold">{photosReussies}</span> photo(s) ajoutée(s){photosEchouees.length > 0 ? <> · <span className="font-semibold text-destructive">{photosEchouees.length}</span> photo(s) en échec</> : null}</>
                )}
              </div>
              {resultat.rejected.length > 0 && (
                <div className="max-h-40 overflow-auto divide-y divide-border/40">
                  {resultat.rejected.map((r, i) => (
                    <div key={i} className="px-3 py-1.5 text-[11.5px]">
                      <span className="text-muted-foreground">Ligne {r.ligne}{r.nom ? ` (${r.nom})` : ""}{r.matricule ? ` · ${r.matricule}` : ""} — </span>
                      <span className="text-foreground">{r.motif}</span>
                    </div>
                  ))}
                </div>
              )}
              {photosEchouees.length > 0 && (
                <div className="max-h-32 overflow-auto divide-y divide-border/40 border-t border-border">
                  {photosEchouees.map((e, i) => (
                    <div key={i} className="px-3 py-1.5 text-[11.5px]">
                      <span className="text-muted-foreground">{e.matricule} — </span>
                      <span className="text-foreground">{e.motif}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Fermer</button>
          <Btn variant="primary" disabled={busy || !contratId || !dossier} onClick={handleImporter}>
            <Upload className="w-4 h-4" />{busy ? "Import en cours…" : "Importer"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
