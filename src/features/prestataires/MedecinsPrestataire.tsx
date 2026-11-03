import { useEffect, useState } from "react";
import { UserRound, Plus, X, Stethoscope, Phone, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { getMedecins, lierStructure, delierStructure, createMedecin, type Medecin } from "@/services/medecins.service";
import { SPECIALITES_SANTE } from "@/lib/specialitesSante";

interface Props { prestataireId: string }

type Mode = "aucun" | "lier" | "creer";

const TITRES = ["Docteur", "Professeur", "Infirmier(e)", "Sage-femme", "Pharmacien(ne)", "Kinésithérapeute", "Opticien(ne)", "Dentiste"];

export function MedecinsPrestataire({ prestataireId }: Props) {
  const [medecins, setMedecins] = useState<Medecin[] | null>(null);
  const [mode, setMode] = useState<Mode>("aucun");
  const [saving, setSaving] = useState(false);

  // Formulaire création rapide
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [titre, setTitre] = useState("");
  const [specialite, setSpecialite] = useState("");
  const [codePraticien, setCodePraticien] = useState("");
  const [telephone, setTelephone] = useState("");

  // Recherche "lier un existant"
  const [tous, setTous] = useState<Medecin[]>([]);
  const [idALier, setIdALier] = useState<string | null>(null);

  const rafraichir = () =>
    getMedecins({ prestataireId }).then(setMedecins).catch(() => setMedecins([]));

  useEffect(() => { rafraichir(); }, [prestataireId]);

  const ouvrirMode = async (m: Mode) => {
    setMode(m);
    if (m === "lier" && tous.length === 0) {
      getMedecins().then(setTous).catch(() => undefined);
    }
  };
  const annuler = () => { setMode("aucun"); setIdALier(null); resetForm(); };

  const resetForm = () => { setNom(""); setPrenom(""); setTitre(""); setSpecialite(""); setCodePraticien(""); setTelephone(""); };

  const handleLier = async () => {
    if (!idALier) return;
    setSaving(true);
    try {
      await lierStructure(idALier, prestataireId);
      await rafraichir();
      annuler();
      toast.success("Médecin lié à la structure.");
    } catch { toast.error("Impossible de lier ce médecin."); }
    finally { setSaving(false); }
  };

  const handleCreer = async () => {
    if (!nom.trim()) { toast.error("Le nom est obligatoire."); return; }
    setSaving(true);
    try {
      await createMedecin({ nom: nom.trim(), prenom: prenom.trim() || undefined, titre: titre || undefined, specialite: specialite || undefined, codePraticien: codePraticien.trim() || undefined, telephone: telephone.trim() || undefined, prestataireIds: [prestataireId] });
      await rafraichir();
      annuler();
      toast.success("Professionnel créé et lié.");
    } catch { toast.error("Impossible de créer ce professionnel."); }
    finally { setSaving(false); }
  };

  const handleDelier = async (medecinId: string, nom: string) => {
    try {
      await delierStructure(medecinId, prestataireId);
      await rafraichir();
      toast.success(`${nom} retiré de la structure.`);
    } catch { toast.error("Impossible de retirer ce professionnel."); }
  };

  const dejaLies = new Set((medecins ?? []).map((m) => m.id));
  const candidats = tous.filter((m) => !dejaLies.has(m.id)).map((m) => ({
    value: m.id,
    label: `${m.titre ? m.titre + " " : ""}${m.nom}${m.prenom ? " " + m.prenom : ""}${m.specialite ? " — " + m.specialite : ""}`,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5" />Professionnels de santé
        </p>
        {mode === "aucun" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => ouvrirMode("lier")} className="h-6 px-2 rounded text-[11px] border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 flex items-center gap-1">
              <Plus className="w-3 h-3" />Lier un médecin
            </button>
            <button type="button" onClick={() => ouvrirMode("creer")} className="h-6 px-2 rounded text-[11px] bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1">
              <UserRound className="w-3 h-3" />Nouveau
            </button>
          </div>
        )}
      </div>

      {/* Liste liée */}
      {medecins === null ? (
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />Chargement…
        </div>
      ) : medecins.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground italic py-1">Aucun professionnel lié à cette structure.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-1.5">Professionnel</th>
                <th className="text-left px-3 py-1.5">Spécialité</th>
                <th className="text-left px-3 py-1.5 hidden sm:table-cell">Code praticien</th>
                <th className="text-left px-3 py-1.5 hidden sm:table-cell">Téléphone</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {medecins.map((m) => (
                <tr key={m.id} className="hover:bg-secondary/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <UserRound className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">
                          {m.titre ? `${m.titre} ` : ""}{m.nom}{m.prenom ? ` ${m.prenom}` : ""}
                        </p>
                        {!m.actif && <Badge variant="danger" className="text-[10px] px-1 py-0">Inactif</Badge>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.specialite ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {m.codePraticien ? <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{m.codePraticien}</span> : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                    {m.telephone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{m.telephone}</span> : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" onClick={() => handleDelier(m.id, `${m.nom}${m.prenom ? " " + m.prenom : ""}`)}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400" title="Retirer de la structure">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lier un médecin existant */}
      {mode === "lier" && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[11.5px] font-semibold text-foreground">Lier un médecin existant</p>
          <Combobox
            items={candidats}
            value={idALier}
            onChange={setIdALier}
            placeholder="Rechercher un médecin…"
            className="h-8 text-[12.5px]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={handleLier} disabled={!idALier || saving}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}Lier
            </button>
            <button type="button" onClick={annuler} className="h-7 px-3 rounded border border-border text-[12px] text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
        </div>
      )}

      {/* Créer et lier un nouveau médecin */}
      {mode === "creer" && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[11.5px] font-semibold text-foreground">Nouveau professionnel</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Nom *</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de famille"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground mt-0.5" />
            </div>
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Prénom</label>
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground mt-0.5" />
            </div>
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Titre</label>
              <select value={titre} onChange={(e) => setTitre(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground mt-0.5">
                <option value="">—</option>
                {TITRES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Spécialité</label>
              <Combobox
                items={SPECIALITES_SANTE.map((s) => ({ value: s, label: s }))}
                value={specialite || null}
                onChange={(v) => setSpecialite(v ?? "")}
                placeholder="Choisir…"
                className="h-8 text-[12.5px] mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Code praticien</label>
              <input value={codePraticien} onChange={(e) => setCodePraticien(e.target.value)} placeholder="N° ordre médecins"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground mt-0.5" />
            </div>
            <div>
              <label className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Téléphone</label>
              <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="07 XX XX XX XX"
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12.5px] text-foreground mt-0.5" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleCreer} disabled={!nom.trim() || saving}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-50 flex items-center gap-1">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}Créer et lier
            </button>
            <button type="button" onClick={annuler} className="h-7 px-3 rounded border border-border text-[12px] text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
