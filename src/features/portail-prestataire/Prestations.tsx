import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { parse, isValid } from "date-fns";
import { Plus, Trash2, Send, ArrowLeft, FileText, Search, RotateCcw, Pencil, Ban, History, X, Check, Stethoscope, FlaskConical } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import { Combobox } from "@/components/shared/Combobox";
import { DateInput } from "@/components/shared/DateInput";
import { fmtM } from "@/lib/format";
import { getActesMedicaux } from "@/services/acteMedical.service";
import type { ActeMedical } from "@/types/acteMedical";
import { OPTIONS_NATURE_MALADIE, type NatureMaladie } from "@/lib/natureMaladie";
import {
  getPrestations, getPrestation, getPatient, creerPrestation, teletransmettrePrestation, voirFacturePrestation,
  modifierLignePrestation, annulerLignePrestation, annulerPrestation, ajouterLignePrestation, apercuLignePrestation, getHistoriquePrestation,
  getMoiPrestataire, voirFeuilleSoinsLigne, voirFeuilleExamenLigne, getMedecinsPrestataire,
  type Prestation, type PatientDetail, type LignePrestationInput, type PrestationLigne, type ModificationHistorique, type ApercuLignePrestation,
  type MedecinPrestataireOption,
} from "@/services/portailPrestataire.service";
import { IdentificationAssure } from "./IdentificationAssure";
import { GROUPES_ACTES, PRESTATION_HANDOFF_KEY, TYPES_PRESTATION_LABELS, type PrestationHandoff } from "./prestationTypes";

// "dd/mm/yyyy" — même repère que partout ailleurs dans l'app.
function parseFr(s: string): Date | null {
  const d = parse(s, "dd/MM/yyyy", new Date());
  return isValid(d) ? d : null;
}
function dansPeriode(dateFr: string, du: string, au: string): boolean {
  const d = parseFr(dateFr);
  if (!d) return true;
  const bDu = du ? parseFr(du) : null;
  const bAu = au ? parseFr(au) : null;
  if (bDu && d < bDu) return false;
  if (bAu && d > bAu) return false;
  return true;
}

// Filtre par famille d'actes (2026-08) — voir demande utilisateur :
// "l'application doit faire un filtre d'actes par famille et non faire
// remonter tous les actes peu importe la famille sélectionnée" — retrouve
// le groupe (voir GROUPES_ACTES) auquel appartient la famille brute d'un
// acte déjà choisi, pour pré-sélectionner le bon filtre en modification.
function groupeDeFamilleActe(famille: string | undefined): string | null {
  return GROUPES_ACTES.find((g) => famille && g.familles.includes(famille))?.cle ?? null;
}

// Feuille de soins / feuille d'examen (2026-08) — voir demande utilisateur :
// "chaque fiche de consultation génère aussi une feuille de soins et
// chaque saisie d'un examen, actes de spécialité, analyse médicale génère
// une feuille d'examen. Le but est de dématérialiser cela" — décide,
// famille par famille, laquelle des deux proposer par ligne.
const GROUPES_EXAMEN = new Set(["Analyse", "Imagerie", "ActesSpecialites"]);
function typeFormulaire(famille: string | undefined): "soins" | "examen" | null {
  const groupe = groupeDeFamilleActe(famille);
  if (groupe === "Consultation") return "soins";
  if (groupe && GROUPES_EXAMEN.has(groupe)) return "examen";
  return null;
}

function statutVariant(s: string): BadgeVariant {
  if (s === "Soumise") return "success";
  if (s === "Annulée") return "danger";
  return "warning";
}

// Statut réel, temps réel (2026-08) — voir demande utilisateur : "le statut
// d'une facture... doit remonter en temps réel en fonction du traitement
// fait côté assurance" — reflète le règlement (bordereau/lettre chèque),
// pas seulement le cycle de vie interne au portail (En saisie/Soumise).
function statutReelVariant(s: string): BadgeVariant {
  if (s === "Payée" || s === "Payé" || s === "Validé") return "success";
  if (s === "Rejeté" || s === "Annulée") return "danger";
  if (s === "Reçu" || s === "En validation" || s === "Soumise — en attente de règlement") return "warning";
  return "neutral";
}

type Vue = "liste" | "identification" | "creation" | "detail";

// Liste + création + détail des prestations (2026-08) — voir demande
// utilisateur : "portail externe dédié au prestataire médical... je veux
// que tu duplique cela", captures de référence fournies par l'utilisateur
// ("LISTE DES PRESTATIONS FINANCIÈRES", "Création des données de la
// consultation", "Détails prestation... Télétransmettre le dossier"). Une
// prestation ici EST une vraie Facture/PriseEnCharge (voir
// PortailPrestataireController) — visible et traitable côté interne comme
// côté portail assuré, sans synchronisation supplémentaire.
export default function PrestatairePrestationsView() {
  const [vue, setVue] = useState<Vue>("liste");
  const [prestations, setPrestations] = useState<Prestation[] | null>(null);
  const [detail, setDetail] = useState<Prestation | null>(null);
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [typePrestation, setTypePrestation] = useState("Ambulatoire");
  // Groupe d'acte choisi en "Nouvelle prestation" (2026-08) — voir demande
  // utilisateur : "il faut... faire remonter les familles des actes",
  // filtre le catalogue proposé ci-dessous à ce seul groupe (voir
  // GROUPES_ACTES) ; null = aucun filtre (catalogue complet).
  const [groupeActeActif, setGroupeActeActif] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toLocaleDateString("fr-FR"));
  // Tarification (2026-08) — voir demande utilisateur : "le prestataire
  // doit pouvoir saisir son tarif (en frais réels) et l'application doit
  // générer cela comme dans la saisie de facture côté assurance" : chaque
  // ligne en attente porte son propre aperçu (prix de référence déjà
  // connu via acte.prixDefaut, taux/part assurance recalculés en direct à
  // chaque changement de "frais réels", même service que FactureSaisie.tsx
  // en interne).
  const [lignesForm, setLignesForm] = useState<(LignePrestationInput & { libelle: string; apercu: ApercuLignePrestation | null; chargementApercu: boolean; prixUnitaire: number })[]>([]);
  const [acteAAjouter, setActeAAjouter] = useState<ActeMedical | null>(null);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  // Nature de l'affection (2026-08) — un seul choix pour toute la
  // prestation en cours de création (même épisode clinique), appliqué à
  // chaque ligne envoyée. Jamais affiché sur le Décompte remis au tiers.
  // Code CNAMGS retiré de cet écran (2026-09) — voir demande utilisateur :
  // "il ne faut pas que l'agent de l'accueil ait la possibilité de
  // renseigner les codes d'affections, cela strictement réservé au médecin
  // traitant" (voir Prescription.codeAffection, saisi par le médecin dans
  // portail-medecin/Consultation.tsx).
  const [natureMaladie, setNatureMaladie] = useState<NatureMaladie>("AffectionCourante");
  // Médecin assigné à la consultation (2026-09) — voir demande
  // utilisateur : "si un médecin n'a pas été sélectionné pour recevoir le
  // patient en consultation, il ne doit pas le voir dans sa file... il
  // faut qu'au niveau de l'accueil, le médecin ait été lié à la
  // prestation consultation qui doit se faire." Obligatoire uniquement
  // quand le groupe d'actes actif est "Consultation" (voir
  // necessiteMedecin plus bas) — sans effet sur les autres familles
  // (Pharmacie, Analyse…), qui n'ont pas de médecin à assigner.
  const [medecinId, setMedecinId] = useState<string | null>(null);
  const [medecins, setMedecins] = useState<MedecinPrestataireOption[]>([]);
  // Visibilité par profil (2026-08) — voir demande utilisateur : "même dans
  // l'ajout d'un nouvel acte à une facture, il faut tenir compte de la
  // famille d'actes auxquelles le prestataire a accès" : même filtre que
  // l'identification du patient (IdentificationAssure.tsx), appliqué ici
  // aussi aux sélecteurs de famille de "Ajouter un acte" et "Modifier une
  // ligne" — vide = aucune restriction (comportement historique).
  const [categoriesActesVisibles, setCategoriesActesVisibles] = useState<string[]>([]);
  const groupesVisibles = useMemo(
    () => (categoriesActesVisibles.length > 0 ? GROUPES_ACTES.filter((g) => categoriesActesVisibles.includes(g.cle)) : GROUPES_ACTES),
    [categoriesActesVisibles],
  );
  const [envoi, setEnvoi] = useState(false);
  const [teletransmission, setTeletransmission] = useState(false);
  // Saisie des critères (2026-08) — voir demande utilisateur : "je veux des
  // zones de saisie de date séparées et non le système actuel, et le
  // bouton rechercher pour lancer la requête" : champs libres, le filtre ne
  // s'applique qu'au clic sur "Rechercher" (voir filtre ci-dessous), jamais
  // à la frappe.
  const [rechercheRef, setRechercheRef] = useState("");
  const [recherchePatient, setRecherchePatient] = useState("");
  const [rechercheDu, setRechercheDu] = useState("");
  const [rechercheAu, setRechercheAu] = useState("");
  const [filtre, setFiltre] = useState({ ref: "", patient: "", du: "", au: "" });

  const rafraichir = () => getPrestations().then(setPrestations);

  const prestationsFiltrees = useMemo(() => {
    const ref = filtre.ref.trim().toLowerCase();
    const nom = filtre.patient.trim().toLowerCase();
    return (prestations ?? []).filter((p) =>
      p.referenceFacture.toLowerCase().includes(ref)
      && (nom === "" || p.lignes.some((l) => l.assureNom.toLowerCase().includes(nom)))
      && dansPeriode(p.dateReception, filtre.du, filtre.au));
  }, [prestations, filtre]);
  const rechercheActive = filtre.ref || filtre.patient || filtre.du || filtre.au;
  const lancerRecherche = () => setFiltre({ ref: rechercheRef, patient: recherchePatient, du: rechercheDu, au: rechercheAu });
  const reinitialiserRecherche = () => {
    setRechercheRef(""); setRecherchePatient(""); setRechercheDu(""); setRechercheAu("");
    setFiltre({ ref: "", patient: "", du: "", au: "" });
  };

  useEffect(() => {
    rafraichir();
    getActesMedicaux().then(setActes);
    getMoiPrestataire().then((p) => setCategoriesActesVisibles(p.categoriesActesVisibles));
    getMedecinsPrestataire().then(setMedecins).catch(() => undefined);
    const brut = sessionStorage.getItem(PRESTATION_HANDOFF_KEY);
    if (brut) {
      sessionStorage.removeItem(PRESTATION_HANDOFF_KEY);
      try {
        const handoff = JSON.parse(brut) as PrestationHandoff;
        const groupe = GROUPES_ACTES.find((g) => g.cle === handoff.groupeActe);
        getPatient(handoff.patientId).then((p) => {
          setPatient(p);
          setTypePrestation(groupe?.typePrestationDefaut ?? "Ambulatoire");
          setGroupeActeActif(handoff.groupeActe);
          setVue("creation");
        });
      } catch { /* handoff malformé — ignoré */ }
    }
  }, []);

// Recalcule l'aperçu (taux/part assurance) d'une ligne en attente,
  // déplacé hors du composant pour être réutilisé par la facture existante
  // (voir plus bas) — évite d'avoir deux implémentations qui divergent.
  const chargerApercu = async (assureId: string, typePrestationLigne: string, montant: number, acteMedicalId?: string, quantite?: number) => {
    try {
      return await apercuLignePrestation({ assureId, typePrestation: typePrestationLigne, montant, acteMedicalId, quantite });
    } catch {
      return null;
    }
  };

  // Pharmacie — prix unitaire × quantité (2026-08) — voir demande
  // utilisateur : "la saisie de la pharmacie repose sur trois critères : le
  // médicament, le prix et la quantité" : pour un acte de la famille
  // PHARMACIE, `montant` (toujours le TOTAL envoyé au serveur, voir
  // create-facture-ligne.dto.ts) est recalculé automatiquement à chaque
  // changement de prix unitaire ou de quantité, plutôt que saisi
  // directement — pour tout autre acte, rien ne change (un seul champ
  // "Frais réels", quantite reste 1).
  const estActePharmacie = (acteMedicalId?: string) => actes.find((a) => a.id === acteMedicalId)?.famille === "PHARMACIE";

  const ajouterActe = async (acte: ActeMedical | null) => {
    if (!acte || !patient) return;
    const index = lignesForm.length;
    const quantite = 1;
    const montant = acte.prixDefaut * quantite;
    // natureMaladie/codeAffection : valeurs provisoires ici (le brouillon
    // de ligne ne les lit jamais) — la vraie valeur envoyée au serveur est
    // TOUJOURS celle du sélecteur partagé au moment de soumettre() (voir
    // plus bas), pas celle stockée sur ce brouillon.
    setLignesForm((v) => [...v, { acteMedicalId: acte.id, montant, quantite, prixUnitaire: acte.prixDefaut, libelle: acte.libelle, apercu: null, chargementApercu: true, natureMaladie: "AffectionCourante", codeAffection: "" }]);
    setActeAAjouter(null);
    const apercu = await chargerApercu(patient.id, typePrestation, montant, acte.id, quantite);
    setLignesForm((v) => v.map((l, idx) => (idx === index ? { ...l, apercu, chargementApercu: false } : l)));
  };
  const retirerLigne = (i: number) => setLignesForm((v) => v.filter((_, idx) => idx !== i));
  const majMontant = (i: number, montant: number) => setLignesForm((v) => v.map((l, idx) => (idx === i ? { ...l, montant } : l)));
  const majPrixUnitaire = (i: number, prixUnitaire: number) => setLignesForm((v) => v.map((l, idx) => (idx === i ? { ...l, prixUnitaire, montant: prixUnitaire * (l.quantite ?? 1) } : l)));
  const majQuantite = (i: number, quantite: number) => setLignesForm((v) => v.map((l, idx) => (idx === i ? { ...l, quantite, montant: (l.prixUnitaire ?? l.montant) * quantite } : l)));
  const rafraichirApercuLigne = async (i: number) => {
    if (!patient) return;
    const l = lignesForm[i];
    if (!l) return;
    setLignesForm((v) => v.map((x, idx) => (idx === i ? { ...x, chargementApercu: true } : x)));
    const apercu = await chargerApercu(patient.id, typePrestation, l.montant, l.acteMedicalId, l.quantite);
    setLignesForm((v) => v.map((x, idx) => (idx === i ? { ...x, apercu, chargementApercu: false } : x)));
  };
  const totalPrestation = lignesForm.reduce((s, l) => s + l.montant, 0);

  const ouvrirDetail = async (id: string) => {
    try {
      setDetail(await getPrestation(id));
      setVue("detail");
      setAfficherHistorique(false);
      setHistorique(null);
      setLignesEnAttente([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prestation indisponible.");
    }
  };

  // Le prestataire n'a pas besoin de "créer" un patient, il doit
  // l'identifier — voir demande utilisateur : "cela permet de savoir à
  // l'avance si la personne est toujours couverte par l'assurance ou pas".
  // "Créer une prestation" ouvre donc l'identification si aucun patient
  // n'est déjà en contexte (venant de l'onglet Patients), jamais un
  // formulaire de saisie de patient.
  const ouvrirCreation = () => {
    if (patient) {
      setLignesForm([]);
      setVue("creation");
      return;
    }
    setVue("identification");
  };

  const identifiePourCreation = (p: PatientDetail, groupeActe: string) => {
    const groupe = GROUPES_ACTES.find((g) => g.cle === groupeActe);
    setPatient(p);
    setTypePrestation(groupe?.typePrestationDefaut ?? "Ambulatoire");
    setGroupeActeActif(groupeActe);
    setLignesForm([]);
    setVue("creation");
  };

  // Retour à la liste (2026-08) — oublie systématiquement le patient
  // identifié : voir demande utilisateur, "il doit l'identifier [à chaque
  // fois]... pour savoir à l'avance si la personne est toujours couverte".
  // Une prochaine "Créer une prestation" repart donc toujours d'une
  // identification fraîche, jamais d'un patient mémorisé d'une session
  // précédente.
  const allerListe = () => {
    setPatient(null);
    setDetail(null);
    setGroupeActeActif(null);
    setVue("liste");
  };

  // Catalogue proposé (2026-08) — filtré au groupe d'acte choisi en
  // "Nouvelle prestation" (voir demande utilisateur : "une pharmacie, un
  // laboratoire n'aura pas besoin de consultation") ; catalogue complet si
  // aucun groupe n'est actif (ex. patient déjà en contexte sans passer par
  // les boutons de groupe).
  const groupeActif = GROUPES_ACTES.find((g) => g.cle === groupeActeActif);
  const actesFiltres = groupeActif ? actes.filter((a) => groupeActif.familles.includes(a.famille)) : actes;
  // Médecin obligatoire UNIQUEMENT pour le groupe "Consultation" (2026-09)
  // — voir demande utilisateur, ci-dessus.
  const necessiteMedecin = groupeActif?.cle === "Consultation";

  const soumettre = async () => {
    if (!patient || lignesForm.length === 0) {
      toast.error("Au moins un acte est requis.");
      return;
    }
    if (necessiteMedecin && !medecinId) {
      toast.error("Sélectionnez le médecin qui reçoit ce patient en consultation.");
      return;
    }
    setEnvoi(true);
    try {
      const cree = await creerPrestation({
        assureId: patient.id, typePrestation, date,
        lignes: lignesForm.map((l) => ({ acteMedicalId: l.acteMedicalId, montant: l.montant, quantite: l.quantite, natureMaladie, medecinId: medecinId ?? undefined })),
      });
      toast.success("Prestation enregistrée.");
      setDetail(cree);
      setMedecinId(null);
      setVue("detail");
      setNatureMaladie("AffectionCourante");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const teletransmettre = async () => {
    if (!detail) return;
    setTeletransmission(true);
    try {
      const mise = await teletransmettrePrestation(detail.id);
      setDetail(mise);
      toast.success("Dossier télétransmis à l'assurance.");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Télétransmission impossible.");
    } finally {
      setTeletransmission(false);
    }
  };

  // Facture imprimable, signée électroniquement (2026-08) — voir demande
  // utilisateur, capture de référence "Facture : Générer/Télécharger/
  // Visualiser" + "authentification infaillible de chaque prestation faite".
  const voirFacture = async () => {
    if (!detail) return;
    try {
      await voirFacturePrestation(detail.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Facture indisponible.");
    }
  };

  // Feuille de soins / feuille d'examen (2026-08) — voir demande
  // utilisateur : "chaque fiche de consultation génère aussi une feuille
  // de soins et chaque saisie d'un examen, actes de spécialité, analyse
  // médicale génère une feuille d'examen. Le but est de dématérialiser
  // cela".
  const voirFormulaire = async (l: PrestationLigne, type: "soins" | "examen") => {
    if (!detail) return;
    try {
      await (type === "soins" ? voirFeuilleSoinsLigne(detail.id, l.id) : voirFeuilleExamenLigne(detail.id, l.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Formulaire indisponible.");
    }
  };

  // Modification / annulation d'une ligne + historique (2026-08) — voir
  // demande utilisateur : "dans la ligne de facture... on doit toujours
  // pouvoir modifier une facture et la mettre à jour... on doit pouvoir
  // annuler une prestation faite par erreur... l'application doit garder
  // l'historique des factures modifiées et le nom de l'utilisateur ayant
  // fait la modification".
  const [ligneEnEdition, setLigneEnEdition] = useState<PrestationLigne | null>(null);
  const [acteEdition, setActeEdition] = useState<ActeMedical | null>(null);
  const [montantEdition, setMontantEdition] = useState(0);
  // Pharmacie — prix unitaire × quantité (2026-08) — voir demande
  // utilisateur ci-dessus, mêmes semantics qu'en création : montantEdition
  // reste le TOTAL envoyé au serveur, recalculé à partir de ces deux champs
  // pour un acte de la famille PHARMACIE.
  const [quantiteEdition, setQuantiteEdition] = useState(1);
  const [prixUnitaireEdition, setPrixUnitaireEdition] = useState(0);
  const [dateEdition, setDateEdition] = useState("");
  const [enregistrementEdition, setEnregistrementEdition] = useState(false);
  const [apercuEdition, setApercuEdition] = useState<ApercuLignePrestation | null>(null);
  const [chargementApercuEdition, setChargementApercuEdition] = useState(false);
  // Filtre par famille, modification d'une ligne (2026-08) — voir demande
  // utilisateur : "l'application doit faire un filtre d'actes par famille".
  const [familleEdition, setFamilleEdition] = useState(GROUPES_ACTES[0].cle);

  const [ligneEnAnnulation, setLigneEnAnnulation] = useState<PrestationLigne | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [envoiAnnulation, setEnvoiAnnulation] = useState(false);

  // Ajout d'une ligne à une facture déjà saisie (2026-08) — voir demande
  // utilisateur : "il faut un vrai formulaire de saisie de facture" +
  // "une fois la saisie terminée, on doit pouvoir enregistrer la
  // modification. Aussi, si on ajoute une ligne, on doit également pouvoir
  // la retirer" : les actes ajoutés restent EN ATTENTE (jamais envoyés un
  // par un) tant que "Enregistrer" n'a pas été cliqué — chacun reste
  // retirable de cette liste d'attente avant l'envoi, même bloc
  // Tarification que la création (prix de référence, taux/part calculée,
  // frais réels éditable).
  const [acteNouveau, setActeNouveau] = useState<ActeMedical | null>(null);
  const [typeNouveau, setTypeNouveau] = useState("Ambulatoire");
  const [dateNouveau, setDateNouveau] = useState(new Date().toLocaleDateString("fr-FR"));
  // Filtre par famille (2026-08) — voir demande utilisateur : "l'application
  // doit faire un filtre d'actes par famille et non faire remonter tous
  // les actes peu importe la famille sélectionnée".
  const [familleNouvelle, setFamilleNouvelle] = useState(GROUPES_ACTES[0].cle);
  const [lignesEnAttente, setLignesEnAttente] = useState<(LignePrestationInput & { libelle: string; apercu: ApercuLignePrestation | null; chargementApercu: boolean; prixUnitaire: number })[]>([]);
  const [enregistrementLignes, setEnregistrementLignes] = useState(false);
  const [natureMaladieNouveau, setNatureMaladieNouveau] = useState<NatureMaladie>("AffectionCourante");
  const [medecinIdNouveau, setMedecinIdNouveau] = useState<string | null>(null);

  // Défaut cohérent avec la visibilité (2026-08) — évite qu'un prestataire
  // restreint (ex. Laboratoire → "Analyse" uniquement) démarre sur "familleNouvelle"
  // = premier groupe global ("Consultation"), invisible pour lui.
  useEffect(() => {
    if (groupesVisibles.length > 0 && !groupesVisibles.some((g) => g.cle === familleNouvelle)) {
      setFamilleNouvelle(groupesVisibles[0].cle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupesVisibles]);

  const assureIdFacture = detail?.lignes[0]?.assureId;

  const ajouterActeEnAttente = async (acte: ActeMedical | null) => {
    if (!acte || !assureIdFacture) return;
    setActeNouveau(null);
    const index = lignesEnAttente.length;
    const quantite = 1;
    const montant = acte.prixDefaut * quantite;
    // natureMaladie/codeAffection : valeurs provisoires (voir ajouterActe
    // ci-dessus) — la vraie valeur envoyée est celle du sélecteur partagé.
    setLignesEnAttente((v) => [...v, { acteMedicalId: acte.id, montant, quantite, prixUnitaire: acte.prixDefaut, libelle: acte.libelle, apercu: null, chargementApercu: true, natureMaladie: "AffectionCourante", codeAffection: "" }]);
    const apercu = await chargerApercu(assureIdFacture, typeNouveau, montant, acte.id, quantite);
    setLignesEnAttente((v) => v.map((l, idx) => (idx === index ? { ...l, apercu, chargementApercu: false } : l)));
  };
  const retirerLigneEnAttente = (i: number) => setLignesEnAttente((v) => v.filter((_, idx) => idx !== i));
  const majMontantEnAttente = (i: number, montant: number) => setLignesEnAttente((v) => v.map((l, idx) => (idx === i ? { ...l, montant } : l)));
  const majPrixUnitaireEnAttente = (i: number, prixUnitaire: number) => setLignesEnAttente((v) => v.map((l, idx) => (idx === i ? { ...l, prixUnitaire, montant: prixUnitaire * (l.quantite ?? 1) } : l)));
  const majQuantiteEnAttente = (i: number, quantite: number) => setLignesEnAttente((v) => v.map((l, idx) => (idx === i ? { ...l, quantite, montant: (l.prixUnitaire ?? l.montant) * quantite } : l)));
  const rafraichirApercuEnAttente = async (i: number) => {
    if (!assureIdFacture) return;
    const l = lignesEnAttente[i];
    if (!l) return;
    setLignesEnAttente((v) => v.map((x, idx) => (idx === i ? { ...x, chargementApercu: true } : x)));
    const apercu = await chargerApercu(assureIdFacture, typeNouveau, l.montant, l.acteMedicalId, l.quantite);
    setLignesEnAttente((v) => v.map((x, idx) => (idx === i ? { ...x, apercu, chargementApercu: false } : x)));
  };

  // Médecin obligatoire UNIQUEMENT pour le groupe "Consultation" (2026-09)
  // — même règle que la création (voir necessiteMedecin plus haut).
  const necessiteMedecinNouveau = familleNouvelle === "Consultation";

  const enregistrerLignesEnAttente = async () => {
    if (!detail || lignesEnAttente.length === 0) return;
    if (necessiteMedecinNouveau && !medecinIdNouveau) {
      toast.error("Sélectionnez le médecin qui reçoit ce patient en consultation.");
      return;
    }
    setEnregistrementLignes(true);
    try {
      let mise = detail;
      for (const l of lignesEnAttente) {
        mise = await ajouterLignePrestation(detail.id, {
          typePrestation: typeNouveau, datePrestation: dateNouveau, acteMedicalId: l.acteMedicalId, montant: l.montant, quantite: l.quantite,
          natureMaladie: natureMaladieNouveau, medecinId: medecinIdNouveau ?? undefined,
        });
      }
      setDetail(mise);
      setLignesEnAttente([]);
      setNatureMaladieNouveau("AffectionCourante");
      setMedecinIdNouveau(null);
      toast.success("Facture mise à jour.");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEnregistrementLignes(false);
    }
  };

  const [historique, setHistorique] = useState<ModificationHistorique[] | null>(null);
  const [afficherHistorique, setAfficherHistorique] = useState(false);

  const ouvrirEdition = async (l: PrestationLigne) => {
    const acteActuel = actes.find((a) => a.id === l.acteMedicalId) ?? null;
    setLigneEnEdition(l);
    setActeEdition(acteActuel);
    setFamilleEdition(groupeDeFamilleActe(acteActuel?.famille) ?? GROUPES_ACTES[0].cle);
    setMontantEdition(l.montant);
    setQuantiteEdition(l.quantite ?? 1);
    setPrixUnitaireEdition(l.quantite ? l.montant / l.quantite : l.montant);
    setDateEdition(l.datePrestation);
    setApercuEdition(null);
    setChargementApercuEdition(true);
    const apercu = await chargerApercu(l.assureId, l.typePrestation, l.montant, l.acteMedicalId ?? undefined, l.quantite);
    setApercuEdition(apercu);
    setChargementApercuEdition(false);
  };

  const majPrixUnitaireEdition = (prix: number) => { setPrixUnitaireEdition(prix); setMontantEdition(prix * quantiteEdition); };
  const majQuantiteEdition = (quantite: number) => { setQuantiteEdition(quantite); setMontantEdition(prixUnitaireEdition * quantite); };

  const rafraichirApercuEdition = async () => {
    if (!ligneEnEdition) return;
    setChargementApercuEdition(true);
    const apercu = await chargerApercu(ligneEnEdition.assureId, ligneEnEdition.typePrestation, montantEdition, acteEdition?.id, quantiteEdition);
    setApercuEdition(apercu);
    setChargementApercuEdition(false);
  };

  const enregistrerEdition = async () => {
    if (!detail || !ligneEnEdition) return;
    setEnregistrementEdition(true);
    try {
      const mise = await modifierLignePrestation(detail.id, ligneEnEdition.id, {
        acteMedicalId: acteEdition?.id, montant: montantEdition, datePrestation: dateEdition, quantite: quantiteEdition,
      });
      setDetail(mise);
      toast.success("Ligne mise à jour.");
      setLigneEnEdition(null);
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Modification impossible.");
    } finally {
      setEnregistrementEdition(false);
    }
  };

  const confirmerAnnulation = async () => {
    if (!detail || !ligneEnAnnulation) return;
    if (!motifAnnulation.trim()) { toast.error("Le motif est obligatoire."); return; }
    setEnvoiAnnulation(true);
    try {
      const mise = await annulerLignePrestation(detail.id, ligneEnAnnulation.id, motifAnnulation.trim());
      setDetail(mise);
      toast.success("Prestation annulée.");
      setLigneEnAnnulation(null);
      setMotifAnnulation("");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      setEnvoiAnnulation(false);
    }
  };

  // Annulation de la facture entière (2026-08) — voir demande utilisateur :
  // "rendre possible la modification d'une facture ou prestation déjà
  // saisie, doit même pour l'annuler".
  const [annulationFactureOuverte, setAnnulationFactureOuverte] = useState(false);
  const [motifAnnulationFacture, setMotifAnnulationFacture] = useState("");
  const [envoiAnnulationFacture, setEnvoiAnnulationFacture] = useState(false);

  const confirmerAnnulationFacture = async () => {
    if (!detail) return;
    if (!motifAnnulationFacture.trim()) { toast.error("Le motif est obligatoire."); return; }
    setEnvoiAnnulationFacture(true);
    try {
      const mise = await annulerPrestation(detail.id, motifAnnulationFacture.trim());
      setDetail(mise);
      toast.success("Facture annulée.");
      setAnnulationFactureOuverte(false);
      setMotifAnnulationFacture("");
      rafraichir();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Annulation impossible.");
    } finally {
      setEnvoiAnnulationFacture(false);
    }
  };

  const basculerHistorique = async () => {
    if (afficherHistorique) { setAfficherHistorique(false); return; }
    setAfficherHistorique(true);
    if (!detail) return;
    try {
      setHistorique(await getHistoriquePrestation(detail.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Historique indisponible.");
    }
  };

  if (vue === "identification") {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Identifier le patient</h1>
        <IdentificationAssure onNouvellePrestation={identifiePourCreation} />
      </div>
    );
  }

  if (vue === "creation" && patient) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Nouvelle consultation</h1>

        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[13.5px] font-semibold text-foreground">{patient.nom} {patient.prenom ?? ""}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">Matricule {patient.matricule} · {patient.contrat.compagnie.nom}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-3.5">
            <label className="block">
              <div className="text-[12px] text-muted-foreground mb-1.5">Type de prestation</div>
              {/* Pharmacie — ambulatoire ou hospitalisation (2026-08) — voir
                  demande utilisateur : "il y a également le principe du taux
                  ambulatoire et du taux hospitalisation. Si on coche la case
                  ambulatoire c'est le taux en ambulatoire qui s'applique...
                  et si on coche la case hospitalisation, ce sera le taux en
                  hospitalisation" — un médicament ne relève plus de la
                  rubrique "Autre", seul ce choix à deux options reste
                  pertinent (voir SanteService.calculerPartAssuranceLigne,
                  toujours au taux Privé pour ce groupe). */}
              {groupeActeActif === "Autre" ? (
                <div className="flex items-center gap-4 h-10">
                  {(["Ambulatoire", "Hospitalisation"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 text-[13px] text-foreground cursor-pointer">
                      <input type="radio" name="typePrestationPharmacie" checked={typePrestation === v} onChange={() => setTypePrestation(v)} />
                      {v}
                    </label>
                  ))}
                </div>
              ) : (
                <select value={typePrestation} onChange={(e) => setTypePrestation(e.target.value)} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground">
                  {TYPES_PRESTATION_LABELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
            </label>
            <label className="block">
              {/* Saisie antidatée (2026-08) — voir demande utilisateur : "je
                  souhaite que le prestataire puisse faire des saisies
                  antidatées". DateInput n'impose aucune borne min/max,
                  navigation libre sur des décennies — déjà utilisable pour
                  saisir une date passée. */}
              <div className="text-[12px] text-muted-foreground mb-1.5">Date des soins</div>
              <DateInput value={date} onChange={setDate} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground" />
            </label>
          </div>

          {/* Nature de l'affection + code CNAMGS (2026-08) — voir demande
              utilisateur : "on doit renseigner le code d'affection pour
              chaque ligne de saisie de la facture... ça permettra à
              l'application d'avoir des données statistique réels de
              santé". Jamais affiché sur le Décompte remis au tiers
              (toujours "Affection Courante" à l'écran) — strictement
              interne/statistique. */}
          <label className="block">
            <div className="text-[12px] text-muted-foreground mb-1.5">Nature de l'affection *</div>
            <div className="flex gap-2">
              {OPTIONS_NATURE_MALADIE.map((o) => (
                <button
                  key={o.valeur} type="button" onClick={() => setNatureMaladie(o.valeur)}
                  className={`h-10 flex-1 px-3 rounded-lg border text-[12.5px] font-medium ${natureMaladie === o.valeur ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </label>

          {necessiteMedecin && (
            <label className="block">
              {/* Médecin assigné (2026-09) — voir demande utilisateur : "au
                  niveau de l'accueil, le médecin doit avoir été lié à la
                  prestation consultation qui doit se faire" — c'est ce
                  choix, et lui seul, qui fait apparaître le patient dans
                  la file d'attente DE CE médecin précisément. */}
              <div className="text-[12px] text-muted-foreground mb-1.5">Médecin recevant le patient *</div>
              <Combobox
                options={medecins} value={medecins.find((m) => m.id === medecinId) ?? null}
                onChange={(m) => setMedecinId(m?.id ?? null)}
                getLabel={(m) => `${m.titre ?? "Dr"} ${m.nom} ${m.prenom ?? ""}`.trim()}
                getSubLabel={(m) => m.specialite || "Généraliste"}
                getId={(m) => m.id}
                placeholder="Rechercher un médecin de la structure…"
              />
            </label>
          )}

          <label className="block">
            <div className="text-[12px] text-muted-foreground mb-1.5">
              Prestation médicale{groupeActif ? ` — ${groupeActif.label}` : ""}
            </div>
            <Combobox
              options={actesFiltres} value={acteAAjouter} onChange={ajouterActe}
              getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
              placeholder="Rechercher un acte…"
            />
            {groupeActif && actesFiltres.length === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">Aucun acte du catalogue ne correspond à « {groupeActif.label} ».</p>
            )}
          </label>

          {lignesForm.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
              {lignesForm.map((l, i) => (
                <div key={i} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-[12.5px] text-foreground font-medium truncate">{l.libelle}</span>
                    <button type="button" onClick={() => retirerLigne(i)} title="Retirer" className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  {/* Tarification (2026-08) — voir demande utilisateur : "le
                      prestataire doit pouvoir saisir son tarif (en frais
                      réels) et l'application doit générer cela comme dans
                      la saisie de facture côté assurance" — même bloc que
                      l'écran interne (prix de référence, taux/part
                      calculée en direct, frais réels éditable). */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Prix de référence : <span className="text-foreground font-medium">{fmtM(actes.find((a) => a.id === l.acteMedicalId)?.prixDefaut ?? 0)} FCFA</span></span>
                    <span>
                      Taux / part assurance :{" "}
                      <span className="text-emerald-600 font-medium">
                        {l.chargementApercu ? "calcul…" : l.apercu?.tauxRemboursement != null ? `${l.apercu.tauxRemboursement}% (${fmtM(l.apercu.baseRemboursement ?? 0)} FCFA)` : "—"}
                      </span>
                    </span>
                  </div>
                  {l.apercu?.messagePlafond && (
                    <p className="text-[10.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1">{l.apercu.messagePlafond}</p>
                  )}
                  {estActePharmacie(l.acteMedicalId) ? (
                    // Pharmacie — prix unitaire × quantité (2026-08) — voir
                    // demande utilisateur : "la saisie de la pharmacie
                    // repose sur trois critères : le médicament, le prix et
                    // la quantité".
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Prix unitaire *</span>
                        <input
                          type="number" value={l.prixUnitaire} onChange={(e) => majPrixUnitaire(i, Number(e.target.value))} onBlur={() => rafraichirApercuLigne(i)}
                          className="w-24 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                          style={{ fontFamily: "'DM Mono', monospace" }}
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Quantité *</span>
                        <input
                          type="number" min={1} value={l.quantite ?? 1} onChange={(e) => majQuantite(i, Math.max(1, Number(e.target.value)))} onBlur={() => rafraichirApercuLigne(i)}
                          className="w-16 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                          style={{ fontFamily: "'DM Mono', monospace" }}
                        />
                      </label>
                      <span className="text-[11px] text-muted-foreground">Total : <span className="text-foreground font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)} FCFA</span></span>
                    </div>
                  ) : (
                    <label className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">Frais réels (coût total) *</span>
                      <input
                        type="number" value={l.montant} onChange={(e) => majMontant(i, Number(e.target.value))} onBlur={() => rafraichirApercuLigne(i)}
                        className="w-28 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                        style={{ fontFamily: "'DM Mono', monospace" }}
                      />
                    </label>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 font-semibold">
                <span className="text-[12px] text-foreground">Total Facture</span>
                <span className="text-[12.5px] text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPrestation)} FCFA</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={allerListe} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Retour</button>
            <button type="button" onClick={soumettre} disabled={envoi} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium disabled:opacity-60">{envoi ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (vue === "detail" && detail) {
    // Lignes annulées exclues des totaux (2026-08) — voir demande
    // utilisateur : "on doit pouvoir annuler une prestation faite par
    // erreur" : une prestation annulée n'a jamais eu lieu, elle ne compte
    // plus dans le total facturé — mais reste visible avec son motif (voir
    // demande utilisateur : "garder l'historique").
    const lignesActives = detail.lignes.filter((l) => l.statut !== "Annulé");
    const totalDetail = lignesActives.reduce((s, l) => s + l.montant, 0);
    const totalRembourse = lignesActives.reduce((s, l) => s + (l.baseRemboursement ?? 0), 0);
    const totalPatient = lignesActives.reduce((s, l) => s + (l.resteACharge ?? l.montant), 0);
    return (
      // Pas de max-width (2026-08) — voir demande utilisateur : "élargis,
      // il y a encore assez de place" — utilise toute la largeur
      // disponible plutôt qu'une limite arbitraire ; le défilement
      // horizontal (overflow-x-auto) reste en secours pour les fenêtres
      // plus étroites.
      <div className="p-6 space-y-4">
        <button type="button" onClick={allerListe} className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3.5 h-3.5" />Retour à la liste
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[1.2rem] font-bold text-foreground">Détails prestation : {detail.referenceFacture}</h1>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">{detail.dateReception}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statutVariant(detail.statut)}>{detail.statut}</Badge>
            {detail.statutReel && <Badge variant={statutReelVariant(detail.statutReel.statut)}>{detail.statutReel.statut}</Badge>}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {/* overflow-x-auto (2026-08) — voir demande utilisateur :
              "problème d'affichage complet de la ligne et des boutons" —
              la colonne Acte (sélecteur de famille + recherche) élargit le
              tableau au-delà de la carte ; un défilement horizontal évite
              que les boutons de droite soient rognés sans recours. */}
          <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left px-3 py-2 whitespace-nowrap">Patient</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Type</th>
                <th className="text-left px-3 py-2 whitespace-nowrap">Date</th>
                <th className="text-left px-3 py-2 whitespace-nowrap" style={{ minWidth: 260 }}>Acte</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Montant</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Remboursé</th>
                <th className="text-right px-3 py-2 whitespace-nowrap">Reste patient</th>
                <th className="whitespace-nowrap" style={{ minWidth: 90 }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {detail.lignes.map((l) => {
                const annulee = l.statut === "Annulé";
                const enEdition = ligneEnEdition?.id === l.id;
                if (enEdition) {
                  return (
                    <Fragment key={l.id}>
                      <tr className="bg-secondary/20">
                        <td className="px-3 py-2 text-foreground">{l.assureNom}</td>
                        <td className="px-3 py-2 text-muted-foreground">{l.typePrestation}</td>
                        <td className="px-3 py-2">
                          <DateInput value={dateEdition} onChange={setDateEdition} className="w-32 h-8 px-2 rounded-lg border border-border bg-background text-[12px] text-foreground" />
                        </td>
                        <td className="px-3 py-2" style={{ width: 260 }}>
                          <div style={{ width: 240 }} className="space-y-1">
                            <select
                              value={familleEdition} onChange={(e) => { setFamilleEdition(e.target.value); setActeEdition(null); }}
                              className="w-full h-7 px-2 rounded-lg border border-border bg-background text-[11px] text-foreground"
                            >
                              {groupesVisibles.map((g) => <option key={g.cle} value={g.cle}>{g.label}</option>)}
                            </select>
                            <Combobox
                              options={actes.filter((a) => groupesVisibles.find((g) => g.cle === familleEdition)?.familles.includes(a.famille))}
                              value={acteEdition} onChange={setActeEdition}
                              getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
                              placeholder="Rechercher un acte…"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {acteEdition?.famille === "PHARMACIE" ? (
                            // Pharmacie — prix unitaire × quantité (2026-08)
                            // — voir demande utilisateur ci-dessus.
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" value={prixUnitaireEdition} onChange={(e) => majPrixUnitaireEdition(Number(e.target.value))} onBlur={rafraichirApercuEdition}
                                  title="Prix unitaire"
                                  className="w-20 h-8 border border-border rounded-lg px-1.5 bg-background text-[11px] text-foreground text-right"
                                  style={{ fontFamily: "'DM Mono', monospace" }}
                                />
                                <span className="text-[10px] text-muted-foreground">×</span>
                                <input
                                  type="number" min={1} value={quantiteEdition} onChange={(e) => majQuantiteEdition(Math.max(1, Number(e.target.value)))} onBlur={rafraichirApercuEdition}
                                  title="Quantité"
                                  className="w-12 h-8 border border-border rounded-lg px-1.5 bg-background text-[11px] text-foreground text-right"
                                  style={{ fontFamily: "'DM Mono', monospace" }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">= {fmtM(montantEdition)} FCFA</span>
                            </div>
                          ) : (
                            <input
                              type="number" value={montantEdition} onChange={(e) => setMontantEdition(Number(e.target.value))} onBlur={rafraichirApercuEdition}
                              className="w-24 h-8 border border-border rounded-lg px-2 bg-background text-[12px] text-foreground text-right"
                              style={{ fontFamily: "'DM Mono', monospace" }}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground" colSpan={2}>—</td>
                        <td></td>
                      </tr>
                      {/* Enregistrer la modification (2026-08) — voir
                          demande utilisateur : "il n'y a toujours pas de
                          bouton pour enregistrer la modification de la
                          facture" — bouton texte pleine largeur, sans
                          ambiguïté, plus le même bloc Tarification que la
                          saisie (prix de référence, taux/part calculée en
                          direct). */}
                      <tr className="bg-secondary/20">
                        <td colSpan={8} className="px-3 pb-3">
                          <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-lg px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              <span>Prix de référence : <span className="text-foreground font-medium">{fmtM(acteEdition?.prixDefaut ?? 0)} FCFA</span></span>
                              <span>
                                Taux / part assurance :{" "}
                                <span className="text-emerald-600 font-medium">
                                  {chargementApercuEdition ? "calcul…" : apercuEdition?.tauxRemboursement != null ? `${apercuEdition.tauxRemboursement}% (${fmtM(apercuEdition.baseRemboursement ?? 0)} FCFA)` : "—"}
                                </span>
                              </span>
                              {apercuEdition?.messagePlafond && <span className="text-amber-700">{apercuEdition.messagePlafond}</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button type="button" onClick={() => setLigneEnEdition(null)} className="h-8 px-3 rounded-lg border border-border text-[12px] text-foreground hover:bg-secondary/40">Annuler</button>
                              <button type="button" onClick={enregistrerEdition} disabled={enregistrementEdition} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-60">
                                {enregistrementEdition ? "Enregistrement…" : "Enregistrer la modification"}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }
                return (
                  <tr key={l.id} className={annulee ? "opacity-60" : ""}>
                    <td className="px-3 py-2 text-foreground">{l.assureNom}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.typePrestation}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.datePrestation}</td>
                    <td className="px-3 py-2 text-foreground">
                      <span className={annulee ? "line-through" : ""}>{l.acteLibelle ?? "—"}</span>
                      {annulee && <p className="text-[10.5px] text-destructive mt-0.5">Annulée — {l.motifAnnulation}</p>}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)}</td>
                    <td className="px-3 py-2 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{l.baseRemboursement != null ? fmtM(l.baseRemboursement) : "—"}</td>
                    <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{l.resteACharge != null ? fmtM(l.resteACharge) : "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {!annulee && (() => {
                        const type = typeFormulaire(actes.find((a) => a.id === l.acteMedicalId)?.famille);
                        return (
                          <div className="inline-flex items-center gap-1">
                            {type === "soins" && (
                              <button type="button" onClick={() => voirFormulaire(l, "soins")} title="Feuille de soins" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary/40 rounded-md"><Stethoscope className="w-3.5 h-3.5" /></button>
                            )}
                            {type === "examen" && (
                              <button type="button" onClick={() => voirFormulaire(l, "examen")} title="Feuille d'examen" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary/40 rounded-md"><FlaskConical className="w-3.5 h-3.5" /></button>
                            )}
                            <button type="button" onClick={() => ouvrirEdition(l)} title="Modifier" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary/40 rounded-md"><Pencil className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setLigneEnAnnulation(l)} title="Annuler" className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary/40 rounded-md"><Ban className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/30 font-semibold">
                <td colSpan={4} className="px-3 py-2 text-foreground">Total</td>
                <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalDetail)} FCFA</td>
                <td className="px-3 py-2 text-right text-emerald-600" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalRembourse)} FCFA</td>
                <td className="px-3 py-2 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(totalPatient)} FCFA</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          </div>
        </div>

        {/* Ajouter un acte à cette facture (2026-08) — voir demande
            utilisateur : "il faut un vrai formulaire de saisie de
            facture" : même bloc que l'écran de création, disponible
            directement depuis une facture déjà saisie. Carte séparée,
            SANS overflow-hidden — sinon le menu déroulant du Combobox est
            rogné par le card précédent (voir demande utilisateur : "les
            actes ne s'affichent pas"). */}
        {detail.statut !== "Annulée" && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3.5 space-y-3">
            <p className="text-[11.5px] font-medium text-muted-foreground">Ajouter un acte à cette facture</p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Pharmacie — ambulatoire ou hospitalisation (2026-08) —
                  voir demande utilisateur ci-dessus, même choix restreint
                  qu'en création. */}
              {familleNouvelle === "Autre" ? (
                <div className="flex items-center gap-3 h-9 px-1">
                  {(["Ambulatoire", "Hospitalisation"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 text-[12.5px] text-foreground cursor-pointer">
                      <input type="radio" name="typeNouveauPharmacie" checked={typeNouveau === v} onChange={() => setTypeNouveau(v)} />
                      {v}
                    </label>
                  ))}
                </div>
              ) : (
                <select value={typeNouveau} onChange={(e) => setTypeNouveau(e.target.value)} className="h-9 px-2.5 rounded-lg border border-border bg-background text-[12.5px] text-foreground">
                  {TYPES_PRESTATION_LABELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              )}
              <DateInput value={dateNouveau} onChange={setDateNouveau} className="w-32 h-9 px-2.5 rounded-lg border border-border bg-background text-[12.5px] text-foreground" />
              {/* Filtre par famille (2026-08) — voir demande utilisateur :
                  "l'application doit faire un filtre d'actes par famille et
                  non faire remonter tous les actes peu importe la famille
                  sélectionnée". */}
              <select value={familleNouvelle} onChange={(e) => { setFamilleNouvelle(e.target.value); setActeNouveau(null); }} className="h-9 px-2.5 rounded-lg border border-border bg-background text-[12.5px] text-foreground">
                {groupesVisibles.map((g) => <option key={g.cle} value={g.cle}>{g.label}</option>)}
              </select>
              <div className="flex-1 min-w-[220px]">
                <Combobox
                  options={actes.filter((a) => groupesVisibles.find((g) => g.cle === familleNouvelle)?.familles.includes(a.famille))}
                  value={acteNouveau} onChange={ajouterActeEnAttente}
                  getLabel={(a) => a.libelle} getSubLabel={(a) => a.famille} getId={(a) => a.id}
                  placeholder="Rechercher un acte à ajouter…"
                />
              </div>
            </div>

            {/* Nature de l'affection + code CNAMGS (2026-08) — voir demande
                utilisateur : "on doit renseigner le code d'affection pour
                chaque ligne de saisie de la facture" — obligatoires,
                jamais affichés sur le Décompte remis au tiers. */}
            <div className="flex flex-wrap items-center gap-2">
              {OPTIONS_NATURE_MALADIE.map((o) => (
                <button
                  key={o.valeur} type="button" onClick={() => setNatureMaladieNouveau(o.valeur)}
                  className={`h-9 px-3 rounded-lg border text-[12.5px] font-medium ${natureMaladieNouveau === o.valeur ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/40"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {necessiteMedecinNouveau && (
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Médecin recevant le patient *</div>
                <Combobox
                  options={medecins} value={medecins.find((m) => m.id === medecinIdNouveau) ?? null}
                  onChange={(m) => setMedecinIdNouveau(m?.id ?? null)}
                  getLabel={(m) => `${m.titre ?? "Dr"} ${m.nom} ${m.prenom ?? ""}`.trim()}
                  getSubLabel={(m) => m.specialite || "Généraliste"}
                  getId={(m) => m.id}
                  placeholder="Rechercher un médecin de la structure…"
                />
              </label>
            )}

            {/* Lignes en attente d'enregistrement (2026-08) — voir demande
                utilisateur : "une fois la saisie terminée, on doit pouvoir
                enregistrer la modification. Aussi, si on ajoute une ligne,
                on doit également pouvoir la retirer". */}
            {lignesEnAttente.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
                {lignesEnAttente.map((l, i) => (
                  <div key={i} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-[12.5px] text-foreground font-medium truncate">{l.libelle}</span>
                      <button type="button" onClick={() => retirerLigneEnAttente(i)} title="Retirer" className="p-1 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Prix de référence : <span className="text-foreground font-medium">{fmtM(actes.find((a) => a.id === l.acteMedicalId)?.prixDefaut ?? 0)} FCFA</span></span>
                      <span>
                        Taux / part assurance :{" "}
                        <span className="text-emerald-600 font-medium">
                          {l.chargementApercu ? "calcul…" : l.apercu?.tauxRemboursement != null ? `${l.apercu.tauxRemboursement}% (${fmtM(l.apercu.baseRemboursement ?? 0)} FCFA)` : "—"}
                        </span>
                      </span>
                    </div>
                    {l.apercu?.messagePlafond && (
                      <p className="text-[10.5px] text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1">{l.apercu.messagePlafond}</p>
                    )}
                    {estActePharmacie(l.acteMedicalId) ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Prix unitaire *</span>
                          <input
                            type="number" value={l.prixUnitaire} onChange={(e) => majPrixUnitaireEnAttente(i, Number(e.target.value))} onBlur={() => rafraichirApercuEnAttente(i)}
                            className="w-24 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                            style={{ fontFamily: "'DM Mono', monospace" }}
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">Quantité *</span>
                          <input
                            type="number" min={1} value={l.quantite ?? 1} onChange={(e) => majQuantiteEnAttente(i, Math.max(1, Number(e.target.value)))} onBlur={() => rafraichirApercuEnAttente(i)}
                            className="w-16 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                            style={{ fontFamily: "'DM Mono', monospace" }}
                          />
                        </label>
                        <span className="text-[11px] text-muted-foreground">Total : <span className="text-foreground font-medium" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(l.montant)} FCFA</span></span>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Frais réels (coût total) *</span>
                        <input
                          type="number" value={l.montant} onChange={(e) => majMontantEnAttente(i, Number(e.target.value))} onBlur={() => rafraichirApercuEnAttente(i)}
                          className="w-28 border border-border rounded-lg px-2 py-1.5 bg-background text-[12px] text-foreground text-right"
                          style={{ fontFamily: "'DM Mono', monospace" }}
                        />
                      </label>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                  <span className="text-[12px] font-semibold text-foreground">
                    Total à ajouter : <span style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(lignesEnAttente.reduce((s, l) => s + l.montant, 0))} FCFA</span>
                  </span>
                  <button type="button" onClick={enregistrerLignesEnAttente} disabled={enregistrementLignes} className="h-8 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-60">
                    {enregistrementLignes ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {detail.statut === "En saisie" && (
            <button type="button" onClick={teletransmettre} disabled={teletransmission} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
              <Send className="w-4 h-4" />{teletransmission ? "Envoi…" : "Télétransmettre le dossier"}
            </button>
          )}
          <button type="button" onClick={voirFacture} className="h-10 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 font-medium inline-flex items-center gap-1.5">
            <FileText className="w-4 h-4" />Voir la facture
          </button>
          <button type="button" onClick={basculerHistorique} className="h-10 px-4 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40 font-medium inline-flex items-center gap-1.5">
            <History className="w-4 h-4" />Historique
          </button>
          {detail.statut !== "Annulée" && (
            <button type="button" onClick={() => setAnnulationFactureOuverte(true)} className="h-10 px-4 rounded-lg border border-destructive/40 text-[13px] text-destructive hover:bg-destructive/10 font-medium inline-flex items-center gap-1.5">
              <Ban className="w-4 h-4" />Annuler la facture
            </button>
          )}
        </div>
        {detail.statut === "Annulée" && detail.motifAnnulation && (
          <p className="text-[12px] text-destructive">Facture annulée — {detail.motifAnnulation}</p>
        )}

        {/* Historique des modifications (2026-08) — voir demande
            utilisateur : "l'application doit garder l'historique des
            factures modifiées et le nom de l'utilisateur ayant fait la
            modification". */}
        {afficherHistorique && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-secondary/30 text-[12px] font-semibold text-foreground">Historique des modifications</div>
            {historique === null ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-[12.5px]">Chargement…</p>
            ) : historique.length === 0 ? (
              <p className="px-4 py-6 text-center text-muted-foreground text-[12.5px]">Aucune modification enregistrée.</p>
            ) : (
              <table className="w-full text-[12px]">
                <tbody className="divide-y divide-border/60">
                  {historique.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-2 text-foreground font-medium whitespace-nowrap">{h.action}</td>
                      <td className="px-4 py-2 text-foreground">{h.utilisateurNom}</td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{new Date(h.dateAction).toLocaleString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Modale d'annulation d'une ligne */}
        {ligneEnAnnulation && (
          <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onClick={() => setLigneEnAnnulation(null)}>
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-3.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-semibold text-foreground">Annuler cette prestation</p>
                <button type="button" onClick={() => setLigneEnAnnulation(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[12.5px] text-muted-foreground">{ligneEnAnnulation.acteLibelle ?? ligneEnAnnulation.typePrestation} — {ligneEnAnnulation.assureNom}, {ligneEnAnnulation.datePrestation}</p>
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Motif de l'annulation *</div>
                <textarea
                  value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} rows={3}
                  placeholder="Ex. erreur de saisie, doublon…"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground"
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setLigneEnAnnulation(null)} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Retour</button>
                <button type="button" onClick={confirmerAnnulation} disabled={envoiAnnulation} className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-[13px] font-medium disabled:opacity-60">{envoiAnnulation ? "Annulation…" : "Confirmer l'annulation"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modale d'annulation de la facture entière */}
        {annulationFactureOuverte && (
          <div className="fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4" onClick={() => setAnnulationFactureOuverte(false)}>
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-5 space-y-3.5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-semibold text-foreground">Annuler cette facture</p>
                <button type="button" onClick={() => setAnnulationFactureOuverte(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <p className="text-[12.5px] text-muted-foreground">{detail.referenceFacture} — toutes les lignes seront exclues des relevés et des règlements. Cette facture ne pourra plus être complétée.</p>
              <label className="block">
                <div className="text-[12px] text-muted-foreground mb-1.5">Motif de l'annulation *</div>
                <textarea
                  value={motifAnnulationFacture} onChange={(e) => setMotifAnnulationFacture(e.target.value)} rows={3}
                  placeholder="Ex. erreur de saisie, facture en double…"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[13px] text-foreground"
                />
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => setAnnulationFactureOuverte(false)} className="flex-1 h-10 rounded-lg border border-border text-[13px] text-foreground hover:bg-secondary/40">Retour</button>
                <button type="button" onClick={confirmerAnnulationFacture} disabled={envoiAnnulationFacture} className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-[13px] font-medium disabled:opacity-60">{envoiAnnulationFacture ? "Annulation…" : "Confirmer l'annulation"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[1.2rem] font-bold text-foreground uppercase tracking-wide">Liste des prestations financières</h1>
        <button type="button" onClick={ouvrirCreation} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" />Créer une prestation
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={rechercheRef} onChange={(e) => setRechercheRef(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRecherche()}
          placeholder="Référence…"
          className="h-9 w-40 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
        <input
          value={recherchePatient} onChange={(e) => setRecherchePatient(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lancerRecherche()}
          placeholder="Nom du patient…"
          className="h-9 w-48 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
        />
        <span className="text-[11.5px] text-muted-foreground">Du</span>
        <DateInput value={rechercheDu} onChange={setRechercheDu} className="h-9 w-32 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground" />
        <span className="text-[11.5px] text-muted-foreground">Au</span>
        <DateInput value={rechercheAu} onChange={setRechercheAu} className="h-9 w-32 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground" />
        <button type="button" onClick={lancerRecherche} className="h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" />Rechercher
        </button>
        {rechercheActive && (
          <button type="button" onClick={reinitialiserRecherche} className="h-9 px-3 rounded-lg border border-border text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 inline-flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />Réinitialiser
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-secondary/40 text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left px-4 py-2.5">Référence</th>
              <th className="text-left px-4 py-2.5">Patient(s)</th>
              <th className="text-left px-4 py-2.5">Date</th>
              <th className="text-right px-4 py-2.5">Montant</th>
              <th className="text-left px-4 py-2.5">Statut</th>
              <th className="text-left px-4 py-2.5">Règlement assurance</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {prestationsFiltrees.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/25 cursor-pointer" onClick={() => ouvrirDetail(p.id)}>
                <td className="px-4 py-2.5 text-foreground font-medium">{p.referenceFacture}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{[...new Set(p.lignes.map((l) => l.assureNom))].join(", ") || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.dateReception}</td>
                <td className="px-4 py-2.5 text-right text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(p.lignes.reduce((s, l) => s + l.montant, 0))} FCFA</td>
                <td className="px-4 py-2.5"><Badge variant={statutVariant(p.statut)}>{p.statut}</Badge></td>
                <td className="px-4 py-2.5">{p.statutReel && <Badge variant={statutReelVariant(p.statutReel.statut)}>{p.statutReel.statut}</Badge>}</td>
                <td className="px-4 py-2.5 text-right text-primary text-[11.5px]">Voir →</td>
              </tr>
            ))}
            {prestations && prestationsFiltrees.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{rechercheActive ? "Aucune prestation ne correspond à cette recherche." : "Aucune prestation pour l'instant."}</td></tr>
            )}
            {!prestations && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Chargement…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
