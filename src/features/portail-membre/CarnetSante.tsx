import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Combobox } from "@/components/shared/Combobox";
import { Badge } from "@/components/shared/Badge";
import { LABEL_STATUT_BON, VARIANT_STATUT_BON } from "@/lib/statutBon";
import {
  getCarnetSante, ajouterCarnetSante, supprimerCarnetSante, urlCarnetSante, getMoi, getMaFamille,
  openFeuilleSoinsDe, openFeuilleExamenBonDe,
  type CarnetSanteDocument, type RubriqueCarnetSante,
} from "@/services/portailMembre.service";
import { useAuth } from "@/auth/AuthContext";
import { InformationsMedicalesCard } from "./InformationsMedicalesCard";

interface Beneficiaire { id: string; nom: string }

const RUBRIQUES: { cle: RubriqueCarnetSante; label: string }[] = [
  { cle: "Ordonnance", label: "Ordonnance" },
  { cle: "Examens", label: "Examens & Compte rendu" },
];

// E-carnet Santé (2026-08) — voir demande utilisateur : "il faut créer dans
// le compte assuré une rubrique appelée E-carnet Santé. Dans cette
// rubrique, on pourra retrouver une rubrique ordonnance et une rubrique
// Examens & Compte rendu. Si les informations ne sont pas systématiquement
// renseignées dans l'application par les structures médicales, l'assuré
// pourra lui-même filmer... l'application doit fonctionner comme des scan
// existant dans les téléphones mobiles pour créer systématiquement des
// documents au format pdf." v1 : photo → PDF (voir CarnetSanteService),
// pas d'OCR (confirmé par l'utilisateur) — capture="environment" dégrade
// proprement en simple sélecteur de fichier sur desktop.
export default function MembreCarnetSanteView() {
  const { currentUser } = useAuth();
  const [rubrique, setRubrique] = useState<RubriqueCarnetSante>("Ordonnance");
  const [documents, setDocuments] = useState<CarnetSanteDocument[] | null>(null);
  // Erreur de chargement (2026-08) — voir demande utilisateur : "l'ordonnance
  // ne remonte pas encore alors qu'elle devait déjà remonter" — un échec de
  // requête (sans .catch()) laissait l'écran bloqué sur "Chargement…" pour
  // toujours, sans jamais réessayer ni prévenir l'assuré.
  const [erreurChargement, setErreurChargement] = useState(false);
  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[] | null>(null);
  const [beneficiaireId, setBeneficiaireId] = useState<string | null>(null);
  const [libelle, setLibelle] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rafraichir = () => {
    setErreurChargement(false);
    getCarnetSante(rubrique)
      .then(setDocuments)
      .catch((err) => {
        setDocuments(null);
        setErreurChargement(true);
        toast.error(err instanceof Error ? err.message : "Chargement du carnet impossible.");
      });
  };

  useEffect(() => { rafraichir(); }, [rubrique]);
  useEffect(() => {
    Promise.all([getMoi(), getMaFamille()]).then(([moi, famille]) => {
      const liste = [
        { id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim() },
        ...famille.map((m) => ({ id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() })),
      ];
      setBeneficiaires(liste);
      setBeneficiaireId(moi.id);
    });
  }, []);

  const choisirPhoto = () => inputRef.current?.click();

  const envoyerPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    setEnvoi(true);
    try {
      await ajouterCarnetSante(rubrique, fichier, { assureId: beneficiaireId ?? undefined, libelle: libelle.trim() || undefined });
      toast.success("Document ajouté.");
      setLibelle("");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const supprimer = async (id: string) => {
    try {
      await supprimerCarnetSante(id);
      toast.success("Document supprimé.");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suppression impossible.");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-[1.2rem] font-bold text-foreground">E-carnet Santé</h1>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">
          Vos informations médicales, ordonnances et comptes rendus d'examens, même quand le prestataire ne les a pas saisis dans l'application.
        </p>
      </div>

      <InformationsMedicalesCard />

      <div className="flex gap-2">
        {RUBRIQUES.map((r) => (
          <button
            key={r.cle}
            type="button"
            onClick={() => setRubrique(r.cle)}
            className={`h-9 px-4 rounded-lg text-[12.5px] font-medium border ${rubrique === r.cle ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-secondary/40"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <p className="text-[11.5px] font-medium text-muted-foreground">Ajouter un document — {rubrique === "Ordonnance" ? "Ordonnance" : "Examens & Compte rendu"}</p>
        {beneficiaires && beneficiaires.length > 1 && (
          <div className="w-full sm:w-64">
            <Combobox
              options={beneficiaires}
              value={beneficiaires.find((b) => b.id === beneficiaireId) ?? null}
              onChange={(b) => setBeneficiaireId(b?.id ?? null)}
              getLabel={(b) => b.id === currentUser?.assureSanteId ? `${b.nom} (vous)` : b.nom}
              getId={(b) => b.id}
            />
          </div>
        )}
        <input
          type="text" value={libelle} onChange={(e) => setLibelle(e.target.value)}
          placeholder="Description (facultatif — ex. Ordonnance Dr Ondo, 24/08/2026)"
          className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
        <input
          ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => envoyerPhoto(e.target.files?.[0])}
        />
        <button
          type="button" onClick={choisirPhoto} disabled={envoi}
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-2 disabled:opacity-60"
        >
          {envoi ? <Upload className="w-4 h-4 animate-pulse" /> : <Camera className="w-4 h-4" />}
          {envoi ? "Envoi…" : "Photographier / choisir un fichier"}
        </button>
      </div>

      {erreurChargement ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px] space-y-2">
          <p>Impossible de charger cette rubrique.</p>
          <button type="button" onClick={rafraichir} className="h-8 px-3 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40">Réessayer</button>
        </div>
      ) : !documents ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Chargement…</div>
      ) : documents.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center text-muted-foreground text-[13px]">Aucun document dans cette rubrique pour l'instant.</div>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground truncate">{d.libelle || "Document"}</p>
                {/* Référence du bon, date de soins, personne concernée
                    (2026-08) — voir demande utilisateur : "on doit voir la
                    référence du bon, la date de soins... la personne
                    concernée... et le statut du bon". */}
                {d.source === "feuille" ? (
                  <p className="text-[11.5px] text-muted-foreground">
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>{d.numero}</span> · {d.dateSoins} · {d.assureNom}
                  </p>
                ) : (
                  <p className="text-[11.5px] text-muted-foreground">{d.assureNom} · {new Date(d.dateAjout).toLocaleDateString("fr-FR")}</p>
                )}
              </div>
              {d.statut && <Badge variant={VARIANT_STATUT_BON[d.statut]}>{LABEL_STATUT_BON[d.statut]}</Badge>}
              {d.source === "upload" ? (
                <a
                  href={urlCarnetSante(d.fichier!)} target="_blank" rel="noreferrer"
                  className="text-[11.5px] font-medium text-primary hover:underline flex-shrink-0"
                >
                  Voir
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => (d.rubrique === "Ordonnance" ? openFeuilleSoinsDe(d.priseEnChargeId!) : openFeuilleExamenBonDe(d.prescriptionId!))}
                  className="text-[11.5px] font-medium text-primary hover:underline flex-shrink-0"
                >
                  Voir
                </button>
              )}
              {d.source === "upload" && (
                <button type="button" onClick={() => supprimer(d.id)} title="Supprimer" className="p-1.5 text-muted-foreground hover:text-destructive rounded-md flex-shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
