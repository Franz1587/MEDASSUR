import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Upload, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Btn } from "@/components/shared/Btn";
import {
  apercuImportLibre, confirmerImportLibre, confirmerPopulation, confirmerActesMedicaux, confirmerClasseur, confirmerPec,
  estPopulation, estActesMedicaux, estClasseur, estPec,
  type LigneApercu, type LignePopulation, type LigneActeMedical,
  type ResultatApercu, type ResultatPopulation, type ResultatActesMedicaux, type ResultatClasseur, type OptionsClasseur,
  type ResultatPec, type ResultatImportLibre, type TypeImportLibre,
} from "@/services/import-libre.service";

// Import libre Ariana (2026-10, étendu 2026-10-31) — PDF, XLS (BIFF8), XLSX,
// CSV, TXT — détection automatique du type (factures / population / actes-médicaux).

interface Props {
  ouvert: boolean;
  onFermer: () => void;
}

// ── Badges ────────────────────────────────────────────────────────────────

function BadgeLigneFact({ l }: { l: LigneApercu }) {
  if (l.miseAJour) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">à corriger</span>;
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">ok</span>;
}

function BadgeLignePop({ l }: { l: LignePopulation }) {
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600 truncate max-w-[140px]" title={l.erreur}>{l.erreur}</span>;
  if (l.doublon) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">inchangé</span>;
  if (l.changementContrat) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">chgt contrat</span>;
  if (l.changementStatut) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">chgt statut</span>;
  if (!l.assureId) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">nouveau</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">doublon</span>;
}

function BadgeLigneActe({ l }: { l: LigneActeMedical }) {
  if (l.erreur) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">{l.erreur}</span>;
  if (l.estNouvel) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">nouveau</span>;
  if (l.changementPrix) return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">maj prix</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">inchangé</span>;
}

// ── Labels de type ────────────────────────────────────────────────────────

const LABELS_TYPE: Record<string, string> = {
  auto: "Détection automatique",
  factures: "Factures",
  population: "Population (assurés)",
  "actes-medicaux": "Actes médicaux",
  classeur: "Classeur multi-feuilles",
  souscripteurs: "Souscripteurs",
  contrats: "Contrats",
  assures: "Assurés",
  "prises-en-charge": "Prises en charge",
  reglements: "Règlements",
};

// ── Tableaux d'aperçu ─────────────────────────────────────────────────────

function TableauFactures({ lignes }: { lignes: LigneApercu[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Réf. facture</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Bénéficiaire</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Désignation</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Prestataire</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Date</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Part fin.</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.miseAJour ? "bg-blue-50/50" : l.doublon ? "bg-amber-50/50" : l.erreur ? "bg-red-50/50" : "hover:bg-muted/30"}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.referenceFacture || "—"}</td>
              <td className="px-2.5 py-1.5">
                <p className="font-medium truncate max-w-[110px] text-foreground">{l.beneficiaire || "—"}</p>
                <p className="text-muted-foreground text-[10px]">{l.matricule}</p>
              </td>
              <td className="px-2.5 py-1.5 truncate max-w-[130px] text-foreground">{l.designation || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[130px] text-foreground">{l.prestataireNom || "—"}</td>
              <td className="px-2.5 py-1.5 whitespace-nowrap text-foreground">{l.datePrestation || "—"}</td>
              <td className="px-2.5 py-1.5 text-right font-medium tabular-nums text-foreground">
                {l.partFinanceur > 0 ? l.partFinanceur.toLocaleString("fr-FR") : "—"}
              </td>
              <td className="px-2.5 py-1.5"><BadgeLigneFact l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauPopulation({ lignes }: { lignes: LignePopulation[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Matricule</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Nom Prénom</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Type</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Statut actuel</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Statut fichier</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.erreur ? "bg-red-50/50" : l.doublon ? "bg-amber-50/50" : l.changementStatut || l.changementContrat ? "bg-blue-50/50" : !l.assureId ? "bg-emerald-50/50" : ""}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.matricule || "—"}</td>
              <td className="px-2.5 py-1.5">
                <p className="font-medium truncate max-w-[130px] text-foreground">{[l.nom, l.prenom].filter(Boolean).join(" ") || "—"}</p>
                {l.dateNaissance && <p className="text-muted-foreground text-[10px]">{l.dateNaissance}</p>}
              </td>
              <td className="px-2.5 py-1.5 text-foreground">{l.typeAssure || "—"}</td>
              <td className="px-2.5 py-1.5 text-foreground">{l.statutActuel || <span className="text-muted-foreground italic">—</span>}</td>
              <td className="px-2.5 py-1.5">
                <span className={l.statutFichier?.toLowerCase().includes("termin") ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                  {l.statutFichier || "—"}
                </span>
              </td>
              <td className="px-2.5 py-1.5"><BadgeLignePop l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableauActes({ lignes }: { lignes: LigneActeMedical[] }) {
  return (
    <div className="border border-border rounded-lg overflow-x-auto max-h-64">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-secondary/40 sticky top-0">
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Code</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Libellé</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Famille</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Prix actuel</th>
            <th className="text-right px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">Nouveau prix</th>
            <th className="text-left px-2.5 py-1.5 whitespace-nowrap text-muted-foreground font-medium">État</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {lignes.map((l, i) => (
            <tr key={i} className={l.erreur ? "bg-red-50/50" : l.estNouvel ? "bg-emerald-50/50" : l.changementPrix ? "bg-blue-50/50" : ""}>
              <td className="px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">{l.code || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[200px] text-foreground font-medium">{l.libelle || "—"}</td>
              <td className="px-2.5 py-1.5 truncate max-w-[120px] text-muted-foreground">{l.famille || "—"}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">
                {l.prixActuel !== null ? l.prixActuel.toLocaleString("fr-FR") : "—"}
              </td>
              <td className={`px-2.5 py-1.5 text-right tabular-nums font-medium ${l.changementPrix ? "text-blue-600" : "text-foreground"}`}>
                {l.prixDefaut > 0 ? l.prixDefaut.toLocaleString("fr-FR") : "—"}
              </td>
              <td className="px-2.5 py-1.5"><BadgeLigneActe l={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Classeur multi-feuilles (participants + synthèse par contrat) ────────

const nf = (n: number) => n.toLocaleString("fr-FR");

function Indicateur({ valeur, libelle, ton }: { valeur: number; libelle: string; ton: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <p className={`text-[18px] font-semibold tabular-nums ${ton}`}>{nf(valeur)}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{libelle}</p>
    </div>
  );
}

function ListeEchantillon({ titre, lignes, total }: { titre: string; lignes: ResultatClasseur["echantillons"]["suspensions"]; total: number }) {
  if (total === 0) return null;
  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-foreground">{titre} ({nf(total)})</summary>
      <div className="max-h-48 overflow-y-auto border-t border-border/60">
        <table className="w-full text-[11.5px]">
          <tbody className="divide-y divide-border/50">
            {lignes.map((l, i) => (
              <tr key={i}>
                <td className="px-2.5 py-1 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{l.matricule}</td>
                <td className="px-2.5 py-1 text-foreground truncate max-w-[200px]">{l.nom || "—"}</td>
                <td className="px-2.5 py-1 text-muted-foreground">{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > lignes.length && <p className="px-3 py-1.5 text-[11px] text-muted-foreground">… et {nf(total - lignes.length)} autre(s), appliqués de la même façon.</p>}
      </div>
    </details>
  );
}

// ── Panneau PEC ────────────────────────────────────────────────────────────
function PanneauPec({ r }: { r: ResultatPec }) {
  const fmtM = (n: number) => n.toLocaleString("fr-FR") + " F";
  const statutList = Object.entries(r.statuts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4 text-[13px]">
      {/* Résumé chiffres clés */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Demandes PEC", val: r.totalPec, cls: "text-foreground" },
          { label: "Actes à importer", val: r.actesACreer, cls: "text-primary font-semibold" },
          { label: "Actes avec montant corrigé", val: r.montantsNegatifs, cls: r.montantsNegatifs > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground" },
          { label: "Assurés non trouvés", val: r.assuresNonTrouves, cls: r.assuresNonTrouves > 0 ? "text-red-600" : "text-muted-foreground" },
          { label: "Prestataires sans correspondance", val: r.prestatairesNonTrouves, cls: r.prestatairesNonTrouves > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Déjà importées", val: r.doublons, cls: "text-muted-foreground" },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-secondary/40 rounded-xl p-3 border border-border/40">
            <p className="text-muted-foreground text-[11px] mb-0.5">{label}</p>
            <p className={`text-lg font-bold ${cls}`}>{val.toLocaleString("fr-FR")}</p>
          </div>
        ))}
      </div>

      {/* Statuts PEC */}
      {statutList.length > 0 && (
        <div className="bg-secondary/30 rounded-xl p-3 border border-border/40">
          <p className="font-medium text-muted-foreground mb-2">Statuts dans le fichier</p>
          <div className="flex flex-wrap gap-2">
            {statutList.map(([s, n]) => (
              <span key={s} className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.startsWith("ACCORD") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s.startsWith("REFUS") ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                {s} — {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Corrections de montants */}
      {r.echantillons.corriges.length > 0 && (
        <details className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3">
          <summary className="cursor-pointer font-medium text-amber-700 dark:text-amber-400">
            {r.montantsNegatifs} montant(s) corrigé(s) — part assurance plafonnée aux frais réels
          </summary>
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-amber-600 dark:text-amber-500 mb-2">L'ancien système appliquait le plafond de garantie comme part assurance même quand les frais réels sont inférieurs. La correction : part assurance = min(frais réels, plafond).</p>
            <table className="w-full text-[11px]">
              <thead><tr className="text-muted-foreground"><th className="text-left pb-1">PEC</th><th className="text-left pb-1">Acte</th><th className="text-right pb-1">Frais</th><th className="text-right pb-1">Ancienne</th><th className="text-right pb-1">Corrigée</th></tr></thead>
              <tbody>
                {r.echantillons.corriges.map((c, i) => (
                  <tr key={i} className="border-t border-amber-100 dark:border-amber-800">
                    <td className="py-0.5 pr-2 text-muted-foreground med-num truncate max-w-[80px]">{c.ref.slice(-10)}</td>
                    <td className="py-0.5 pr-2 truncate max-w-[140px]">{c.acte}</td>
                    <td className="py-0.5 pr-2 text-right">{fmtM(c.fraisReels)}</td>
                    <td className="py-0.5 pr-2 text-right text-red-500">{fmtM(c.ancienne)}</td>
                    <td className="py-0.5 text-right text-emerald-600">{fmtM(c.nouvelle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Anomalies */}
      {r.anomalies.length > 0 && (
        <div className="space-y-2">
          {r.anomalies.map((a) => (
            <details key={a.type} className="bg-secondary/40 border border-border/40 rounded-xl p-3">
              <summary className="cursor-pointer font-medium text-foreground">
                <span className="text-red-600 mr-1">⚠</span> {a.type} — {a.nombre}
              </summary>
              {a.exemples.length > 0 && (
                <ul className="mt-1 ml-3 text-[11px] text-muted-foreground space-y-0.5">
                  {a.exemples.slice(0, 5).map((ex, i) => <li key={i}>{ex}</li>)}
                </ul>
              )}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function PanneauClasseur({ r, options, onOptions }: { r: ResultatClasseur; options: OptionsClasseur; onOptions: (o: OptionsClasseur) => void }) {
  const t = r.totaux;
  const maj = (cle: keyof OptionsClasseur, valeur: boolean) => onOptions({ ...options, [cle]: valeur });
  const cases: { cle: "statuts" | "contrats" | "telephones" | "factures" | "identite" | "types" | "matricules" | "creerAbsents"; titre: string; aide: string; actif: boolean }[] = [
    { cle: "identite", titre: `Compléter ${nf(t.naissancesAjoutees)} date(s) de naissance et ${nf(t.sexesAjoutes)} sexe(s) manquants`, aide: "Seulement les champs vides : une date ou un sexe déjà renseigné n'est jamais écrasé, les désaccords sont listés plus bas.", actif: true },
    { cle: "types", titre: `Corriger le type AS / CJ / EF de ${nf(t.typesCorriges)} personne(s), dont ${nf(t.rattachements)} à rattacher à leur assuré principal`, aide: "Le type pilote le calcul des primes. Une famille est reconnue quand un seul assuré principal partage le contrat et le téléphone ; sinon la personne est laissée telle quelle.", actif: true },
    { cle: "matricules", titre: `Aligner ${nf(t.alignements)} matricule(s) sur le matricule conservé`, aide: "Feuille « doublons supprimés » : la personne enregistrée sous l'ancien matricule prend le nouveau ; l'ancien reste recherchable.", actif: true },
    { cle: "statuts", titre: `Mettre à jour les statuts (${nf(t.suspensions)} suspension(s), ${nf(t.reactivations)} réactivation(s))`, aide: "« Terminé » devient Suspendu, « Actif » réactive. Un assuré Radié n'est jamais modifié ; un contrat résilié ou expiré ne réactive personne.", actif: true },
    { cle: "contrats", titre: `Corriger le contrat de ${nf(t.deplacements)} assuré(s) (+ ${nf(t.membresSuivent)} ayant(s) droit)`, aide: "Le classeur fait foi : l'assuré est rattaché au contrat indiqué, avec sa famille. Aucun avenant n'est généré (correction, pas un transfert).", actif: true },
    { cle: "factures", titre: `Affecter au bon contrat les ${nf(t.prestationsSuivent)} prestation(s) de ces assurés, avec leurs factures et ententes`, aide: "Les factures dont toutes les lignes ont changé de contrat suivent aussi. Sans cette case, l'historique reste sur l'ancien contrat.", actif: options.contrats },
    { cle: "telephones", titre: `Renseigner ${nf(t.telephonesAjoutes)} numéro(s) de téléphone manquant(s)`, aide: "Assurés principaux uniquement, jamais un numéro déjà renseigné ni déjà porté par une autre famille.", actif: true },
    { cle: "creerAbsents", titre: `Créer les ${nf(t.absents)} personne(s) absente(s) de l'application`, aide: "Désactivé par défaut : le fichier ne donne ni date de naissance ni lien familial. Création en assuré principal, avec avenant d'incorporation.", actif: true },
  ];
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-[12.5px] font-medium text-foreground">Analyse de chaque feuille, comparée à l'application</p>
        {r.feuilles.map((f) => (
          <details key={f.nom} className="rounded-lg border border-border" open={f.role.startsWith("Population")}>
            <summary className="cursor-pointer px-3 py-2 text-[12.5px] text-foreground">
              <span className="font-medium">{f.nom}</span> — {f.role}, {nf(f.lignes)} ligne(s)
            </summary>
            <div className="border-t border-border/60 px-3 py-2 space-y-2">
              <ul className="list-disc pl-5 text-[11.5px] text-foreground space-y-0.5">
                {f.resume.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
              <div className="overflow-x-auto max-h-44 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead><tr className="text-muted-foreground bg-secondary/40 sticky top-0">
                    <th className="text-left px-2 py-1 font-medium">Colonne</th><th className="text-left px-2 py-1 font-medium">Contenu reconnu</th>
                    <th className="text-right px-2 py-1 font-medium">Remplie</th><th className="text-right px-2 py-1 font-medium">Retrouvée en base</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border/50">
                    {f.colonnes.map((c) => (
                      <tr key={c.entete}>
                        <td className="px-2 py-1 text-foreground">{c.entete}</td>
                        <td className="px-2 py-1 text-muted-foreground">{c.sens}</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">{c.remplies} %</td>
                        <td className="px-2 py-1 text-right tabular-nums text-foreground">{c.rapprochees !== undefined ? `${c.rapprochees} %` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Indicateur valeur={t.lignesParticipants} libelle="participants lus" ton="text-foreground" />
        <Indicateur valeur={t.suspensions + t.reactivations} libelle="changements de statut" ton="text-blue-600" />
        <Indicateur valeur={t.deplacements} libelle="contrats à corriger" ton="text-purple-600" />
        <Indicateur valeur={t.telephonesAjoutes} libelle="téléphones à ajouter" ton="text-emerald-600" />
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-[12.5px] font-medium text-foreground mb-1">Ce qu'ARIANA va appliquer</legend>
        {cases.map((c) => (
          <label key={c.cle} className={`flex items-start gap-3 p-2.5 rounded-lg border border-border bg-secondary/30 ${c.actif ? "cursor-pointer hover:bg-secondary/50" : "opacity-50"}`}>
            <input type="checkbox" disabled={!c.actif} checked={options[c.cle] && c.actif} onChange={(e) => maj(c.cle, e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
            <span>
              <span className="text-[12.5px] font-medium text-foreground block">{c.titre}</span>
              <span className="text-[11px] text-muted-foreground">{c.aide}</span>
            </span>
          </label>
        ))}
        {r.contrats.length > 0 && (
          <label className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-secondary/30">
            <span className="mt-0.5 w-4" />
            <span className="flex-1">
              <span className="text-[12.5px] font-medium text-foreground block">Libellé produit des contrats (feuille de synthèse)</span>
              <select aria-label="Mise à jour du libellé produit" value={options.produits} onChange={(e) => onOptions({ ...options, produits: e.target.value as OptionsClasseur["produits"] })}
                className="mt-1 h-8 px-2 rounded-md border border-border bg-background text-[12px] text-foreground">
                <option value="aucun">Ne pas modifier</option>
                <option value="vides">Renseigner seulement les produits vides ({nf(t.contratsProduitVide)})</option>
                <option value="tous">Remplacer aussi les produits différents ({nf(t.contratsProduitVide + t.contratsProduitEcart)})</option>
              </select>
              <span className="block text-[11px] text-muted-foreground mt-1">{nf(t.contratsProduitEcart)} contrat(s) ont un libellé différent dans le classeur : vérifiez le tableau ci-dessous avant de les remplacer.</span>
            </span>
          </label>
        )}
      </fieldset>

      <ListeEchantillon titre="Changements de contrat" lignes={r.echantillons.deplacements} total={t.deplacements} />
      <ListeEchantillon titre="Suspensions" lignes={r.echantillons.suspensions} total={t.suspensions} />
      <ListeEchantillon titre="Réactivations" lignes={r.echantillons.reactivations} total={t.reactivations} />
      <ListeEchantillon titre="Téléphones à ajouter" lignes={r.echantillons.telephones} total={t.telephonesAjoutes} />
      <ListeEchantillon titre="Personnes absentes de l'application" lignes={r.echantillons.absents} total={t.absents} />
      <ListeEchantillon titre="Types à corriger" lignes={r.echantillons.types} total={t.typesCorriges} />
      <ListeEchantillon titre="Matricules à aligner" lignes={r.echantillons.alignements} total={t.alignements} />

      {r.ecarts.length > 0 && (
        <details className="rounded-lg border border-border" open>
          <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-foreground">Désaccords entre le fichier et l'application ({r.ecarts.reduce((s, e) => s + e.nombre, 0)}) — aucun n'est modifié automatiquement</summary>
          <div className="border-t border-border/60 px-3 py-2 space-y-2">
            {r.ecarts.map((e) => (
              <div key={e.champ} className="text-[11.5px]">
                <p className="text-foreground"><span className="font-medium">{nf(e.nombre)}</span> — {e.champ}{e.note ? <span className="text-muted-foreground"> ({e.note})</span> : null}</p>
                <p className="text-muted-foreground">Exemples : {e.exemples.join(" · ")}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {r.contrats.length > 0 && (
        <details className="rounded-lg border border-border">
          <summary className="cursor-pointer px-3 py-2 text-[12.5px] font-medium text-foreground">
            Contrats de la feuille de synthèse ({nf(r.contrats.length)}) — dont {nf(t.contratsSouscripteurEcart)} avec un souscripteur différent
          </summary>
          <div className="max-h-56 overflow-auto border-t border-border/60">
            <table className="w-full text-[11.5px]">
              <thead><tr className="bg-secondary/40 sticky top-0 text-muted-foreground">
                <th className="text-left px-2.5 py-1 font-medium">Police</th><th className="text-left px-2.5 py-1 font-medium">Produit (application → classeur)</th><th className="text-left px-2.5 py-1 font-medium">Souscripteur (application → classeur)</th>
              </tr></thead>
              <tbody className="divide-y divide-border/50">
                {r.contrats.map((c) => (
                  <tr key={c.police} className={c.ecartSouscripteur ? "bg-amber-50/60" : ""}>
                    <td className="px-2.5 py-1 font-mono text-[10px] whitespace-nowrap text-foreground">{c.police}</td>
                    <td className="px-2.5 py-1 text-foreground">{c.produitActuel || <em className="text-muted-foreground">vide</em>}{c.produitFichier && c.produitFichier !== c.produitActuel ? <> → <strong>{c.produitFichier}</strong></> : null}</td>
                    <td className="px-2.5 py-1 text-foreground">{c.souscripteurBase || "—"}{c.ecartSouscripteur ? <> → <strong>{c.souscripteurFichier}</strong> <span className="text-amber-700">(à vérifier)</span></> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border/60">Les souscripteurs ne sont jamais modifiés automatiquement : un écart signale une contradiction à trancher à la main.</p>
        </details>
      )}

      {r.anomalies.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 space-y-2">
          <p className="text-[12.5px] font-medium text-amber-800 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" aria-hidden />Non traité — à vérifier</p>
          {r.anomalies.map((a) => (
            <div key={a.type} className="text-[11.5px] text-foreground">
              <p><span className="font-medium">{nf(a.nombre)}</span> — {a.libelle}</p>
              <p className="text-muted-foreground">Exemples : {a.exemples.join(" · ")}</p>
            </div>
          ))}
        </div>
      )}

      {r.constats.length > 0 && (
        <ul className="list-disc pl-5 text-[11.5px] text-muted-foreground space-y-0.5">
          {r.constats.slice(0, 20).map((c, i) => <li key={i}>{c}</li>)}
          {r.constats.length > 20 && <li>… et {r.constats.length - 20} autre(s) constat(s).</li>}
        </ul>
      )}
    </div>
  );
}

// ── Aperçu générique (Ariana résumé) ─────────────────────────────────────

function ApercuGenerique({ r }: { r: ResultatApercu }) {
  return (
    <div className="space-y-3">
      {r.apercu && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <p className="text-[13px] text-foreground flex gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            {r.apercu}
          </p>
        </div>
      )}
      {r.colonnesDetectees && r.colonnesDetectees.length > 0 && (
        <div className="p-3 rounded-lg border border-border bg-secondary/30">
          <p className="text-[11px] text-muted-foreground font-medium mb-1">Colonnes détectées</p>
          <div className="flex flex-wrap gap-1">
            {r.colonnesDetectees.map((c) => (
              <span key={c} className="px-1.5 py-0.5 bg-secondary text-[10px] rounded font-mono">{c}</span>
            ))}
          </div>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">
        {r.totalLignes} ligne(s) détectée(s) — Pour importer ces données, utilisez l'import dédié dans le module correspondant.
      </p>
    </div>
  );
}

// ── Composant principal ────────────────────────────────────────────────────

interface EtatFichier {
  nom: string;
  resultat: ResultatImportLibre;
}

export function ImportLibreModal({ ouvert, onFermer }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [etape, setEtape] = useState<"upload" | "analyse" | "apercu" | "confirmation">("upload");
  const [fichiers, setFichiers] = useState<EtatFichier[]>([]);
  const [fichierEnCours, setFichierEnCours] = useState("");
  const [modeCorrection, setModeCorrection] = useState(false);
  const [typeImport, setTypeImport] = useState<TypeImportLibre>("auto");
  const [optionsClasseur, setOptionsClasseur] = useState<OptionsClasseur>({ statuts: true, contrats: true, telephones: true, factures: true, identite: true, types: false, matricules: false, creerAbsents: false, produits: "vides" });

  if (!ouvert) return null;

  const reset = () => { setEtape("upload"); setFichiers([]); setFichierEnCours(""); setTypeImport("auto"); };
  const fermer = () => { reset(); onFermer(); };

  // Résumé selon le type détecté
  const totalAction = fichiers.reduce((s, f) => {
    const r = f.resultat;
    if (estPec(r)) return s + r.actesACreer;
    if (estClasseur(r)) {
      const t = r.totaux, o = optionsClasseur;
      return s + (o.statuts ? t.suspensions + t.reactivations : 0) + (o.contrats ? t.deplacements : 0) + (o.telephones ? t.telephonesAjoutes : 0)
        + (o.identite ? t.naissancesAjoutees + t.sexesAjoutes : 0) + (o.types ? t.typesCorriges : 0) + (o.matricules ? t.alignements : 0)
        + (o.creerAbsents ? t.absents : 0) + (o.produits !== "aucun" ? t.contratsProduitVide + (o.produits === "tous" ? t.contratsProduitEcart : 0) : 0);
    }
    if (estPopulation(r)) return s + r.totalNouveaux + r.totalChangementsStatut + r.totalChangementsContrat;
    if (estActesMedicaux(r)) return s + r.totalNouveaux + r.totalMisesAJour;
    return s + (r as ResultatApercu).totalResolues + (r as ResultatApercu).totalMisesAJour;
  }, 0);

  const typeDetecte: TypeImportLibre | null = fichiers.length > 0
    ? ((fichiers[0].resultat as { typeDetecte?: TypeImportLibre }).typeDetecte ?? null)
    : null;

  const handleFichiers = async (liste: FileList) => {
    setEtape("analyse");
    const resultats: EtatFichier[] = [...fichiers];
    for (const fichier of Array.from(liste)) {
      setFichierEnCours(fichier.name);
      try {
        const res = await apercuImportLibre(fichier, modeCorrection, typeImport);
        resultats.push({ nom: fichier.name, resultat: res });
      } catch (err) {
        toast.error(`${fichier.name} : ${err instanceof Error ? err.message : "Analyse impossible."}`);
      }
    }
    setFichiers(resultats);
    setEtape(resultats.length > 0 ? "apercu" : "upload");
    setFichierEnCours("");
  };

  const handleConfirmer = async () => {
    if (totalAction === 0) { toast.warning("Aucune ligne éligible à l'import."); return; }
    setEtape("confirmation");
    try {
      let msgs: string[] = [];

      for (const f of fichiers) {
        const r = f.resultat;
        if (estPec(r)) {
          const b = await confirmerPec(r.planId);
          if (b.creesAccords) msgs.push(`${b.creesAccords} dossier(s) de prise en charge créé(s) (certificat disponible)`);
          if (b.crees) msgs.push(`${b.crees} ligne(s) d'acte importée(s)`);
          if (b.montantsCorrigés) msgs.push(`${b.montantsCorrigés} montant(s) corrigé(s) (part assurance plafonnée aux frais réels)`);
          if (b.doublonsIgnores) msgs.push(`${b.doublonsIgnores} déjà importée(s), ignorée(s)`);
          if (b.erreurs.length) toast.warning(`Erreurs : ${b.erreurs.slice(0, 3).join(" ; ")}`);
        } else if (estClasseur(r)) {
          const b = await confirmerClasseur(r.planId, optionsClasseur);
          if (b.deplaces) msgs.push(`${b.deplaces} assuré(s) rattaché(s) au bon contrat${b.membresDeplaces ? ` (+${b.membresDeplaces} ayant(s) droit)` : ""}`);
          if (b.prestationsRattachees) msgs.push(`${b.prestationsRattachees} prestation(s), ${b.facturesRattachees} facture(s) et ${b.ententesRattachees} entente(s) affectée(s)`);
          if (b.statutsModifies) msgs.push(`${b.statutsModifies} statut(s) mis à jour`);
          if (b.alignes) msgs.push(`${b.alignes} matricule(s) aligné(s)`);
          if (b.typesCorriges) msgs.push(`${b.typesCorriges} type(s) corrigé(s)${b.rattaches ? ` dont ${b.rattaches} ayant(s) droit rattaché(s)` : ""}`);
          if (b.naissancesAjoutees || b.sexesAjoutes) msgs.push(`${b.naissancesAjoutees} date(s) de naissance et ${b.sexesAjoutes} sexe(s) complété(s)`);
          if (b.telephonesAjoutes) msgs.push(`${b.telephonesAjoutes} téléphone(s) ajouté(s)`);
          if (b.crees) msgs.push(`${b.crees} personne(s) créée(s)`);
          if (b.produitsMisAJour) msgs.push(`${b.produitsMisAJour} produit(s) de contrat mis à jour`);
          if (b.ignores) msgs.push(`${b.ignores} ignoré(s)`);
          if (b.erreurs.length) toast.warning(`${b.erreurs.length} point(s) à vérifier : ${b.erreurs.slice(0, 3).join(" ")}`);
        } else if (estPopulation(r)) {
          const lignesAction = r.lignes.filter((l) => !l.erreur && !l.doublon);
          if (lignesAction.length > 0) {
            const res = await confirmerPopulation(lignesAction);
            if (res.crees) msgs.push(`${res.crees} assuré(s) créé(s)`);
            if (res.miseAJour) msgs.push(`${res.miseAJour} mis à jour`);
            if (res.ignorees) msgs.push(`${res.ignorees} ignoré(s)`);
          }
        } else if (estActesMedicaux(r)) {
          const lignesAction = r.lignes.filter((l) => !l.erreur && (l.estNouvel || l.changementPrix));
          if (lignesAction.length > 0) {
            const res = await confirmerActesMedicaux(lignesAction);
            if (res.crees) msgs.push(`${res.crees} acte(s) créé(s)`);
            if (res.miseAJour) msgs.push(`${res.miseAJour} prix mis à jour`);
            if (res.ignorees) msgs.push(`${res.ignorees} ignoré(s)`);
          }
        } else {
          const ra = r as ResultatApercu;
          // Lignes déjà importées comprises : elles corrigent l'existant
          // (bénéficiaire, acte, net à payer) et éliminent les doublons.
          const lignesValides = ra.lignes.filter((l) => l.assureId && !l.erreur);
          if (lignesValides.length > 0) {
            const res = await confirmerImportLibre(lignesValides, modeCorrection, "factures");
            if (res.importees) msgs.push(`${res.importees} ligne(s) importée(s)`);
            if (res.corrigees) msgs.push(`${res.corrigees} ligne(s) déjà importée(s) corrigée(s)`);
            if (res.doublonsAnnules) msgs.push(`${res.doublonsAnnules} doublon(s) d'import annulé(s)`);
            if (res.ignorees) msgs.push(`${res.ignorees} déjà à jour ou ignorée(s)`);
          }
        }
      }

      toast.success(msgs.length > 0 ? msgs.join(", ") + "." : "Import terminé.");
      fermer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import impossible.");
      setEtape("apercu");
    }
  };

  const labelTypeDetecte = typeDetecte ? LABELS_TYPE[typeDetecte] : null;

  return (
    <div className="fixed inset-0 z-[95] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* En-tête */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Import libre — ARIANA
            </h3>
            {etape === "apercu" && fichiers.length > 0 && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                <span className="font-medium">{fichiers.length} fichier(s)</span>
                {labelTypeDetecte && <> · <span className="text-primary font-medium">{labelTypeDetecte}</span></>}
                {" — "}
                <span className="text-emerald-600">{totalAction} action(s)</span>
              </p>
            )}
          </div>
          <button type="button" onClick={fermer} className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground inline-flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* Zone upload */}
          {etape === "upload" && (
            <div className="space-y-4">
              {/* Sélecteur de type */}
              <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2">
                <p className="text-[12.5px] font-medium text-foreground">Type de données</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {([
                    ["auto", "Automatique", "Ariana détecte le type"],
                    ["factures", "Factures", "Liste de factures détaillées"],
                    ["population", "Population", "Assurés / participants"],
                    ["actes-medicaux", "Actes médicaux", "Catalogue de tarifs"],
                    ["souscripteurs", "Souscripteurs", "via Ariana"],
                    ["contrats", "Contrats", "via Ariana"],
                    ["prises-en-charge", "Prises en charge", "via Ariana"],
                    ["reglements", "Règlements", "via Ariana"],
                  ] as [TypeImportLibre, string, string][]).map(([val, label, desc]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setTypeImport(val)}
                      className={`px-2.5 py-2 rounded-lg border text-left transition-colors ${typeImport === val ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      <span className={`text-[12px] font-medium block ${typeImport === val ? "text-primary" : "text-foreground"}`}>{label}</span>
                      <span className="text-[10px] text-muted-foreground">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode correction (factures seulement) */}
              {typeImport === "factures" && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors">
                  <input type="checkbox" checked={modeCorrection} onChange={(e) => setModeCorrection(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border accent-primary" />
                  <div>
                    <p className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                      Mode correction
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Corrige les montants à 0 sur les lignes déjà importées sans créer de doublons.</p>
                  </div>
                </label>
              )}

              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length > 0) handleFichiers(e.dataTransfer.files); }}
              >
                <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="font-medium text-foreground">Glisser-déposer un ou plusieurs fichiers, ou cliquer pour choisir</p>
                <p className="text-[13px] text-muted-foreground mt-1">PDF, Excel (.xlsx / .xls), CSV, TXT — max 50 Mo par fichier</p>
                {typeImport === "auto" && (
                  <p className="text-[11px] text-primary/80 mt-2 flex items-center justify-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Ariana détecte automatiquement le type de données
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv,.txt"
                  className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFichiers(e.target.files); }}
                />
              </div>
            </div>
          )}

          {/* Analyse en cours */}
          {etape === "analyse" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">ARIANA analyse <span className="text-primary">{fichierEnCours}</span>…</p>
              {fichiers.length > 0 && <p className="text-[13px] text-muted-foreground">{fichiers.length} fichier(s) déjà analysé(s)</p>}
              <p className="text-[13px] text-muted-foreground">Détection du type · Extraction des données · Résolution des doublons</p>
            </div>
          )}

          {/* Confirmation en cours */}
          {etape === "confirmation" && (
            <div className="flex flex-col items-center gap-4 py-16">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="font-medium text-foreground">Import en cours…</p>
            </div>
          )}

          {/* Aperçu */}
          {etape === "apercu" && fichiers.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground flex-wrap">
                {fichiers.map((f) => (
                  <span key={f.nom} className="font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded">{f.nom}</span>
                ))}
                <button type="button" onClick={reset} className="text-[11px] underline hover:text-foreground ml-1">Changer les fichiers</button>
                <button type="button" onClick={() => inputRef.current?.click()} className="text-[11px] underline hover:text-foreground text-primary">
                  + Ajouter d'autres fichiers
                </button>
                <input ref={inputRef} type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt" className="hidden"
                  onChange={(e) => { if (e.target.files && e.target.files.length > 0) handleFichiers(e.target.files); }} />
              </div>

              {fichiers.map((f, fi) => {
                const r = f.resultat;
                const titre = LABELS_TYPE[((r as { typeDetecte?: string }).typeDetecte) ?? ""] ?? "Document";
                return (
                  <div key={fi} className="space-y-2">
                    {fichiers.length > 1 && (
                      <p className="text-[12px] font-medium text-foreground">
                        {f.nom} — <span className="text-primary">{titre}</span>
                      </p>
                    )}
                    {estPec(r) ? (
                      <PanneauPec r={r} />
                    ) : estClasseur(r) ? (
                      <PanneauClasseur r={r} options={optionsClasseur} onOptions={setOptionsClasseur} />
                    ) : estPopulation(r) ? (
                      r.lignes.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span className="text-[13px]">Aucune ligne extraite de la population.</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-3 text-[12px]">
                            {r.police && <span className="text-muted-foreground">Police : <span className="font-medium text-foreground">{r.police}</span></span>}
                            {r.organisme && <span className="text-muted-foreground">Organisme : <span className="font-medium text-foreground">{r.organisme}</span></span>}
                            <span className="text-emerald-600 font-medium">{r.totalNouveaux} nouveaux</span>
                            {r.totalChangementsStatut > 0 && <span className="text-blue-600 font-medium">{r.totalChangementsStatut} chgt statut</span>}
                            {r.totalChangementsContrat > 0 && <span className="text-purple-600 font-medium">{r.totalChangementsContrat} chgt contrat</span>}
                            {r.totalDoublons > 0 && <span className="text-amber-600">{r.totalDoublons} inchangés</span>}
                            {r.totalErreurs > 0 && <span className="text-red-600">{r.totalErreurs} erreurs</span>}
                          </div>
                          <TableauPopulation lignes={r.lignes} />
                        </>
                      )
                    ) : estActesMedicaux(r) ? (
                      r.lignes.length === 0 ? (
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-4">
                          <AlertTriangle className="w-5 h-5 shrink-0" />
                          <span className="text-[13px]">Aucun acte extrait du catalogue.</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-3 text-[12px]">
                            <span className="text-emerald-600 font-medium">{r.totalNouveaux} nouveaux actes</span>
                            {r.totalMisesAJour > 0 && <span className="text-blue-600 font-medium">{r.totalMisesAJour} prix à mettre à jour</span>}
                            {r.totalDoublons > 0 && <span className="text-amber-600">{r.totalDoublons} inchangés</span>}
                            {r.totalErreurs > 0 && <span className="text-red-600">{r.totalErreurs} erreurs</span>}
                          </div>
                          <TableauActes lignes={r.lignes} />
                        </>
                      )
                    ) : (r as ResultatApercu).lignes.length === 0 ? (
                      <ApercuGenerique r={r as ResultatApercu} />
                    ) : (
                      <TableauFactures lignes={(r as ResultatApercu).lignes} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
          {etape === "apercu" && totalAction > 0 ? (
            <>
              <div className="flex items-center gap-1.5 text-[13px] text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                {totalAction} action(s) à appliquer
              </div>
              <div className="flex gap-2">
                <Btn variant="secondary" onClick={fermer}>Annuler</Btn>
                <Btn variant="primary" onClick={handleConfirmer}>Confirmer l'import</Btn>
              </div>
            </>
          ) : (
            <div className="ml-auto">
              <Btn variant="secondary" onClick={fermer}>Fermer</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
