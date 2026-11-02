import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Badge, Card, EmptyState, ErrorView, FormField, inputStyle, LoadingView, PrimaryButton, Screen, SectionTitle } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { messageErreur } from "../../api/http";
import { getMaFamille, getMoi } from "../../api/portailMembre";
import { obtenirPositionActuelle } from "../../utils/position";
import { formatDateDigits, formatHeureDigits } from "../../utils/saisieDate";
import { getReseauSoins, type PrestataireReseau } from "../../api/reseauSoins";
import {
  ajouterMesure, annulerRendezVous, convertirBonPapier, dateHeureFr, fermerAccesDossier, getAccesDossier, getMesMesures, getMesRendezVous,
  getProfessionnels, getStructuresMedicales, lireBonPapier, nomMedecin, ouvrirAccesDossier, prendreRendezVous, supprimerMesure, TYPES_MESURE, UNITE_MESURE, versIso,
  type AccesDossier, type LigneLue, type MesureSante, type Professionnel, type RendezVous, type StatutRendezVous, type StructureMedicale, type TypeRendezVous,
} from "../../api/suiviSante";

type Nav = NativeStackNavigationProp<RootStackParamList>;
const VARIANTE: Record<StatutRendezVous, "success" | "warning" | "danger" | "info" | "neutral"> = { Demandé: "warning", Confirmé: "success", Refusé: "danger", Annulé: "neutral", Honoré: "info", Absent: "neutral" };
export const BadgeRdv = ({ statut }: { statut: StatutRendezVous }) => <Badge label={statut === "Demandé" ? "En attente" : statut} variant={VARIANTE[statut]} />;

function useBeneficiaires() {
  const [liste, setListe] = useState<{ id: string; nom: string; vous: boolean }[]>([]);
  useEffect(() => {
    Promise.all([getMoi(), getMaFamille().catch(() => [])]).then(([moi, famille]) => setListe([
      { id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim(), vous: true },
      ...famille.map((f) => ({ id: f.id, nom: `${f.nom} ${f.prenom ?? ""}`.trim(), vous: false })),
    ])).catch(() => undefined);
  }, []);
  return liste;
}

function Puces<T extends string>({ options, valeur, onChange, libelle }: { options: { id: T; nom: string }[]; valeur: T; onChange: (v: T) => void; libelle?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {libelle ? <Text style={s.label}>{libelle}</Text> : null}
      <View style={s.puces}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.puce, valeur === o.id && s.puceActive]}>
            <Text style={[s.puceTexte, valeur === o.id && s.puceTexteActive]}>{o.nom}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Recherche dans une liste de la base, avec saisie libre si l'entrée n'y
// est pas (ex. établissement hors réseau) : le texte tapé est gardé.
function ChampRecherche<T>({ options, valeur, texte, onChoix, onTexte, libelle, sousLibelle, cle, placeholder }: {
  options: T[]; valeur: T | null; texte: string; onChoix: (o: T | null) => void; onTexte: (t: string) => void;
  libelle: (o: T) => string; sousLibelle?: (o: T) => string; cle: (o: T) => string; placeholder: string;
}) {
  const [focus, setFocus] = useState(false);
  const affiche = valeur ? libelle(valeur) : texte;
  const q = sansAccent(affiche);
  const suggestions = focus && !valeur ? options.filter((o) => !q || sansAccent(libelle(o)).includes(q) || (sousLibelle && sansAccent(sousLibelle(o)).includes(q))).slice(0, 8) : [];
  return (
    <View>
      <View>
        <TextInput value={affiche} onChangeText={(t) => { if (valeur) onChoix(null); onTexte(t); }} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 200)}
          placeholder={placeholder} placeholderTextColor={colors.textSubtle} style={[inputStyle.base, valeur ? { borderColor: colors.primary, paddingRight: 40 } : null]} />
        {valeur ? <Pressable onPress={() => { onChoix(null); onTexte(""); }} style={s.effacer} accessibilityLabel="Effacer"><Ionicons name="close-circle" size={20} color={colors.textMuted} /></Pressable> : null}
      </View>
      {valeur ? <Text style={[s.muted, { marginTop: 4 }]}>✓ Trouvé dans la base{sousLibelle ? ` · ${sousLibelle(valeur)}` : ""}</Text> : null}
      {suggestions.length ? (
        <View style={s.suggestions}>
          {suggestions.map((o) => (
            <Pressable key={cle(o)} onPress={() => { onChoix(o); setFocus(false); }} style={s.suggestion}>
              <Text style={s.texte}>{libelle(o)}</Text>
              {sousLibelle ? <Text style={s.muted}>{sousLibelle(o)}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : focus && !valeur && q ? <Text style={[s.muted, { marginTop: 4 }]}>Pas dans la liste : « {affiche.trim()} » sera gardé tel quel.</Text> : null}
    </View>
  );
}

const sansAccent = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
// Rapproche un nom lu sur le papier d'une entrée de la base.
function rapprocher<T>(texte: string, options: T[], nom: (o: T) => string): T | null {
  const t = sansAccent(texte);
  if (t.length < 3) return null;
  return options.find((o) => sansAccent(nom(o)) === t) ?? options.find((o) => { const n = sansAccent(nom(o)); return n.length >= 4 && (t.includes(n) || n.includes(t)); }) ?? null;
}

// Médecins du réseau : recherche ou tri par distance autour de l'assuré.
function ChoixMedecin({ valeur, structure, onChange, prestataireId }: { valeur: Professionnel | null; structure: string | null; onChange: (m: Professionnel | null, structureId: string | null) => void; prestataireId?: string }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pros, setPros] = useState<Professionnel[] | null>(null);
  const [localisation, setLocalisation] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => getProfessionnels({ q: q.trim() || undefined, prestataireId, ...(pos ?? {}) }).then(setPros).catch(() => setPros([])), 300);
    return () => clearTimeout(t);
  }, [q, pos, prestataireId]);

  const autourDeMoi = async () => {
    setLocalisation(true);
    const p = await obtenirPositionActuelle();
    setLocalisation(false);
    if (!p) { Alert.alert("Position indisponible", "Autorisez la localisation pour voir les médecins les plus proches."); return; }
    setPos({ lat: p.latitude, lng: p.longitude });
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Nom ou spécialité" placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { flex: 1 }]} />
        <Pressable onPress={autourDeMoi} style={s.boutonPos} accessibilityLabel="Médecins autour de moi">
          {localisation ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="locate" size={20} color={colors.primary} />}
        </Pressable>
      </View>
      {pros === null ? <LoadingView /> : pros.length === 0 ? <Text style={s.muted}>Aucun médecin trouvé.</Text> : pros.slice(0, 30).map((m) => (
        <Pressable key={m.id} onPress={() => onChange(m, m.structures[0]?.id ?? null)} style={[s.pro, valeur?.id === m.id && s.proActif]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="medkit-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.titre}>{nomMedecin(m)}</Text>
              <Text style={s.muted}>{m.specialite ?? "Médecine générale"}{m.distanceKm !== null ? ` · à ${m.distanceKm} km` : ""}</Text>
            </View>
          </View>
          {valeur?.id === m.id && m.structures.map((st) => (
            <Pressable key={st.id} onPress={() => onChange(m, st.id)} style={s.structure}>
              <Ionicons name={structure === st.id ? "radio-button-on" : "radio-button-off"} size={16} color={colors.primary} />
              <Text style={[s.muted, { flex: 1 }]}>{st.nom}{st.ville ? ` — ${st.ville}` : ""}{st.distanceKm !== null ? ` (${st.distanceKm} km)` : ""}</Text>
            </Pressable>
          ))}
        </Pressable>
      ))}
    </View>
  );
}

// ── Conversion d'un document papier du carnet en bon électronique ──────
export function ConvertirBonScreen() {
  const navigation = useNavigation<Nav>();
  const { documentId, assureId } = useRoute<RouteProp<RootStackParamList, "ConvertirBon">>().params;
  const [etat, setEtat] = useState<"cours" | "ok" | "echec">("cours");
  const [remarque, setRemarque] = useState("");
  const [entete, setEntete] = useState({ prescripteur: "", structure: "", date: "", codeAffection: "" });
  const [lignes, setLignes] = useState<LigneLue[]>([]);
  const [beneficiaire, setBeneficiaire] = useState(assureId);
  const [envoi, setEnvoi] = useState(false);
  // Établissement et prescripteur pris dans la base, saisie libre sinon.
  const [structures, setStructures] = useState<PrestataireReseau[]>([]);
  const [medecins, setMedecins] = useState<Professionnel[]>([]);
  const [structure, setStructure] = useState<PrestataireReseau | null>(null);
  const [medecin, setMedecin] = useState<Professionnel | null>(null);
  useEffect(() => {
    getReseauSoins().then(setStructures).catch(() => undefined);
    getProfessionnels().then(setMedecins).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (etat !== "ok") return;
    if (!structure && structures.length) setStructure(rapprocher(entete.structure, structures, (x) => x.nom));
    if (!medecin && medecins.length) setMedecin(rapprocher(entete.prescripteur, medecins, (m) => `${m.prenom ?? ""} ${m.nom}`) ?? rapprocher(entete.prescripteur, medecins, (m) => m.nom));
  }, [etat, structures, medecins]); // eslint-disable-line react-hooks/exhaustive-deps
  const medecinsProposes = structure ? medecins.filter((m) => m.structures.some((x) => x.id === structure.id)) : medecins;
  const vide: LigneLue = { type: "Medicament", libelle: "", quantite: 1, posologie: "", acteMedicalId: null, acteLibelle: null };

  useEffect(() => {
    lireBonPapier(documentId).then((l) => {
      setBeneficiaire(l.assureId);
      setEntete({ prescripteur: l.prescripteur, structure: l.structure, date: l.date, codeAffection: l.codeAffection });
      setLignes(l.lignes.length ? l.lignes : [vide]);
      setRemarque([!l.lisible && "Document peu lisible : vérifiez chaque ligne.", l.typeDocument === "Autre" && "Ce document ne ressemble pas à une prescription.", l.remarques].filter(Boolean).join(" "));
      setEtat("ok");
    }).catch((err) => { setRemarque(`${messageErreur(err, "Lecture impossible.")} Saisissez les lignes à la main.`); setLignes([vide]); setEtat("echec"); });
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (i: number, p: Partial<LigneLue>) => setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...p, ...(p.libelle !== undefined ? { acteMedicalId: null, acteLibelle: null } : {}) } : x)));

  const valider = async () => {
    const retenues = lignes.filter((l) => l.libelle.trim());
    if (!retenues.length) { Alert.alert("Lignes manquantes", "Ajoutez au moins un médicament ou un examen."); return; }
    setEnvoi(true);
    try {
      const r = await convertirBonPapier(documentId, {
        assureId: beneficiaire, prescripteurNom: medecin ? nomMedecin(medecin) : entete.prescripteur, structureNom: structure?.nom ?? entete.structure, dateOrdonnance: entete.date, codeAffection: entete.codeAffection || undefined,
        lignes: retenues.map((l) => ({ type: l.type, libelle: l.libelle, quantite: l.quantite, posologie: l.posologie || undefined, acteMedicalId: l.acteMedicalId ?? undefined })),
      });
      Alert.alert("Bon électronique créé", `${[r.numeroOrdonnance && `Ordonnance ${r.numeroOrdonnance}`, r.numeroBonExamen && `Bon d'examen ${r.numeroBonExamen}`].filter(Boolean).join("\n")}\n\nPrésentez cette référence en pharmacie ou au laboratoire (aussi envoyée par SMS).`);
      navigation.goBack();
    } catch (err) {
      Alert.alert("Erreur", messageErreur(err, "Conversion impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  if (etat === "cours") return <View style={s.centre}><ActivityIndicator size="large" color={colors.primary} /><Text style={[s.muted, { marginTop: 12 }]}>ARIANA lit votre document…</Text></View>;

  return (
    <Screen>
      {remarque ? <Card style={{ backgroundColor: etat === "echec" ? colors.warningBg : colors.infoBg }}><Text style={s.texte}>{remarque}</Text></Card> : null}
      <FormField label="Établissement">
        <ChampRecherche options={structures} valeur={structure} texte={entete.structure} placeholder="Rechercher ou saisir l'établissement"
          onChoix={(x) => { setStructure(x); if (x && medecin && !medecin.structures.some((m) => m.id === x.id)) setMedecin(null); }} onTexte={(t) => setEntete((e) => ({ ...e, structure: t }))}
          libelle={(x) => x.nom} sousLibelle={(x) => [x.type, x.ville].filter(Boolean).join(" · ")} cle={(x) => x.id} />
      </FormField>
      <FormField label="Prescripteur">
        <ChampRecherche options={medecinsProposes} valeur={medecin} texte={entete.prescripteur} placeholder="Rechercher ou saisir le médecin"
          onChoix={setMedecin} onTexte={(t) => setEntete((e) => ({ ...e, prescripteur: t }))}
          libelle={nomMedecin} sousLibelle={(m) => m.specialite ?? "Médecine générale"} cle={(m) => m.id} />
      </FormField>
      <FormField label="Date de l'ordonnance"><TextInput value={entete.date} onChangeText={(v) => setEntete({ ...entete, date: formatDateDigits(v) })} placeholder="JJ/MM/AAAA" placeholderTextColor={colors.textSubtle} maxLength={10} style={inputStyle.base} keyboardType="number-pad" /></FormField>
      <SectionTitle>Lignes</SectionTitle>
      {lignes.map((l, i) => (
        <Card key={i}>
          <Puces options={[{ id: "Medicament", nom: "Médicament" }, { id: "Examen", nom: "Examen" }]} valeur={l.type} onChange={(t) => maj(i, { type: t })} />
          <TextInput value={l.libelle} onChangeText={(v) => maj(i, { libelle: v })} placeholder="Libellé" placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { marginBottom: 6 }]} />
          {l.acteLibelle ? <Text style={[s.muted, { marginBottom: 6 }]}>Catalogue : {l.acteLibelle}</Text> : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput value={String(l.quantite)} onChangeText={(v) => maj(i, { quantite: Math.max(1, Number(v) || 1) })} keyboardType="number-pad" style={[inputStyle.base, { width: 70 }]} accessibilityLabel="Quantité" />
            <TextInput value={l.posologie} onChangeText={(v) => maj(i, { posologie: v })} placeholder="Posologie" placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { flex: 1 }]} />
            <Pressable onPress={() => setLignes((x) => x.filter((_, k) => k !== i))} style={s.boutonPos} accessibilityLabel="Retirer la ligne"><Ionicons name="trash-outline" size={18} color={colors.danger} /></Pressable>
          </View>
        </Card>
      ))}
      <PrimaryButton label="Ajouter une ligne" variant="outline" icon="add" onPress={() => setLignes((x) => [...x, vide])} />
      <View style={{ height: spacing.md }} />
      <PrimaryButton label="Créer le bon électronique" icon="checkmark" onPress={valider} loading={envoi} />
    </Screen>
  );
}

// ── Rendez-vous ─────────────────────────────────────────────────────────
const aVenir = (r: RendezVous) => ["Demandé", "Confirmé"].includes(r.statut) && new Date(r.dateHeure).getTime() > Date.now() - 3600_000;

function CarteRdv({ r, action }: { r: RendezVous; action?: React.ReactNode }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.titre}>{dateHeureFr(r.dateHeure)} · {r.type}{r.specialite ? ` · ${r.specialite}` : ""}</Text>
          <Text style={s.muted}>{r.medecin ? nomMedecin(r.medecin) : "Médecin à affecter par l'établissement"}{r.prestataire ? ` — ${r.prestataire.nom}` : ""}</Text>
          <Text style={s.muted}>{r.assure.prenom ?? ""} {r.assure.nom}{r.motif ? ` · ${r.motif}` : ""}</Text>
          {r.reponse ? <Text style={[s.texte, { marginTop: 4 }]}>Réponse : {r.reponse}</Text> : null}
        </View>
        <BadgeRdv statut={r.statut} />
      </View>
      {action}
    </Card>
  );
}

export function RendezVousScreen() {
  const navigation = useNavigation<Nav>();
  const [liste, setListe] = useState<RendezVous[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => { setErreur(null); getMesRendezVous().then(setListe).catch((e) => setErreur(messageErreur(e, "Chargement impossible."))); }, []);
  useEffect(() => navigation.addListener("focus", charger), [navigation, charger]);

  const annuler = (r: RendezVous) => Alert.alert("Annuler ce rendez-vous ?", dateHeureFr(r.dateHeure), [
    { text: "Non", style: "cancel" },
    { text: "Annuler le rendez-vous", style: "destructive", onPress: () => annulerRendezVous(r.id).then(charger).catch((e) => Alert.alert("Erreur", messageErreur(e))) },
  ]);

  const prochains = (liste ?? []).filter(aVenir).sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));
  const passes = (liste ?? []).filter((r) => !aVenir(r));
  return (
    <Screen onRefresh={charger}>
      <PrimaryButton label="Prendre un rendez-vous" icon="calendar-outline" onPress={() => navigation.navigate("RendezVousNouveau", {})} />
      <View style={{ height: spacing.lg }} />
      {erreur && !liste ? <ErrorView message={erreur} onRetry={charger} /> : !liste ? <LoadingView /> : (
        <>
          <SectionTitle>À venir</SectionTitle>
          {prochains.length === 0 ? <EmptyState icon="calendar-outline" title="Aucun rendez-vous à venir" /> : prochains.map((r) => (
            <CarteRdv key={r.id} r={r} action={<Pressable onPress={() => annuler(r)} style={{ marginTop: 8 }}><Text style={{ color: colors.danger, fontWeight: "600" }}>Annuler</Text></Pressable>} />
          ))}
          {passes.length ? <><SectionTitle style={{ marginTop: spacing.md }}>Historique</SectionTitle>{passes.map((r) => <CarteRdv key={r.id} r={r} />)}</> : null}
        </>
      )}
    </Screen>
  );
}

export function RendezVousNouveauScreen() {
  const navigation = useNavigation<Nav>();
  const { prestataireId } = useRoute<RouteProp<RootStackParamList, "RendezVousNouveau">>().params ?? {};
  const beneficiaires = useBeneficiaires();
  const [assureId, setAssureId] = useState("");
  const [type, setType] = useState<TypeRendezVous>("Consultation");
  // Structure → spécialité → médecin de la structure (ou affecté par elle).
  const [structures, setStructures] = useState<StructureMedicale[] | null>(null);
  const [recherche, setRecherche] = useState("");
  const [localisation, setLocalisation] = useState(false);
  const [structure, setStructure] = useState<StructureMedicale | null>(null);
  const [specialite, setSpecialite] = useState("");
  const [medecins, setMedecins] = useState<Professionnel[] | null>(null);
  const [medecin, setMedecin] = useState<Professionnel | null>(null);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("09:00");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);
  const choisirStructure = (st: StructureMedicale | null) => {
    setStructure(st);
    setSpecialite(st?.specialites.length === 1 ? st.specialites[0] : "");
  };
  useEffect(() => {
    getStructuresMedicales().then((l) => {
      setStructures(l);
      const depuisReseau = prestataireId ? l.find((x) => x.id === prestataireId) : undefined;
      if (depuisReseau) choisirStructure(depuisReseau);
    }).catch(() => setStructures([]));
  }, [prestataireId]);
  useEffect(() => {
    setMedecin(null);
    if (!structure || !specialite) { setMedecins(null); return; }
    getProfessionnels({ prestataireId: structure.id, specialite }).then(setMedecins).catch(() => setMedecins([]));
  }, [structure, specialite]);

  const autourDeMoi = async () => {
    setLocalisation(true);
    const p = await obtenirPositionActuelle();
    if (p) setStructures(await getStructuresMedicales({ lat: p.latitude, lng: p.longitude }).catch(() => structures));
    else Alert.alert("Position indisponible", "Autorisez la localisation pour voir les établissements les plus proches.");
    setLocalisation(false);
  };
  const q = sansAccent(recherche);
  const proposees = (structures ?? []).filter((x) => !q || sansAccent(`${x.nom} ${x.ville ?? ""} ${x.type ?? ""} ${x.specialites.join(" ")}`).includes(q)).slice(0, 25);

  const demander = async () => {
    const iso = versIso(jour, heure);
    if (!structure) { Alert.alert("Établissement", "Choisissez l'établissement."); return; }
    if (structure.specialites.length > 0 && !specialite) { Alert.alert("Spécialité", "Choisissez la spécialité."); return; }
    if (!iso) { Alert.alert("Date", "Saisissez la date (JJ/MM/AAAA) et l'heure (HH:MM)."); return; }
    setEnvoi(true);
    try {
      await prendreRendezVous({ assureId, prestataireId: structure.id, medecinId: medecin?.id, specialite: specialite || undefined, type, motif: motif.trim() || undefined, dateHeure: iso });
      Alert.alert("Demande envoyée", "Vous serez notifié dès que le rendez-vous sera confirmé.");
      navigation.goBack();
    } catch (err) {
      Alert.alert("Erreur", messageErreur(err, "Demande impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Screen>
      {beneficiaires.length > 1 ? <Puces libelle="Pour" options={beneficiaires.map((b) => ({ id: b.id, nom: b.vous ? `${b.nom} (vous)` : b.nom }))} valeur={assureId} onChange={setAssureId} /> : null}
      <Puces libelle="Type" options={[{ id: "Consultation", nom: "Consultation" }, { id: "Contrôle", nom: "Contrôle de santé" }, { id: "Examen", nom: "Examen" }]} valeur={type} onChange={(t) => setType(t as TypeRendezVous)} />
      <Text style={s.label}>1. Établissement</Text>
      {structure ? (
        <Pressable onPress={() => choisirStructure(null)} style={[s.pro, s.proActif]} accessibilityLabel="Changer d'établissement">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="business-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.titre}>{structure.nom}</Text>
              <Text style={s.muted}>{[structure.type, structure.ville].filter(Boolean).join(" · ")} · Changer</Text>
            </View>
          </View>
        </Pressable>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
            <TextInput value={recherche} onChangeText={setRecherche} placeholder="Clinique, hôpital, ville, spécialité…" placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { flex: 1 }]} />
            <Pressable onPress={autourDeMoi} style={s.boutonPos} accessibilityLabel="Établissements autour de moi">
              {localisation ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="locate" size={20} color={colors.primary} />}
            </Pressable>
          </View>
          {structures === null ? <LoadingView /> : proposees.length === 0 ? <Text style={s.muted}>Aucun établissement trouvé.</Text> : proposees.map((x) => (
            <Pressable key={x.id} onPress={() => choisirStructure(x)} style={s.pro}>
              <Text style={s.titre}>{x.nom}</Text>
              <Text style={s.muted}>{[x.type, x.ville, x.distanceKm !== null ? `à ${x.distanceKm} km` : null, x.nbMedecins ? `${x.nbMedecins} médecin${x.nbMedecins > 1 ? "s" : ""}` : "aucun médecin enregistré"].filter(Boolean).join(" · ")}</Text>
            </Pressable>
          ))}
        </>
      )}
      {structure && structure.specialites.length > 0 ? (
        <Puces libelle="2. Spécialité / type de consultation" options={structure.specialites.map((x) => ({ id: x, nom: x }))} valeur={specialite} onChange={setSpecialite} />
      ) : structure ? <Text style={[s.muted, { marginBottom: spacing.md }]}>Aucun médecin n'est encore enregistré dans cet établissement : il recevra votre demande et vous affectera un praticien.</Text> : null}
      {specialite ? (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={s.label}>3. Médecin</Text>
          {medecins === null ? <LoadingView /> : (
            <>
              <Pressable onPress={() => setMedecin(null)} style={[s.pro, !medecin && s.proActif]}>
                <Text style={s.titre}>Premier médecin disponible</Text>
                <Text style={s.muted}>L'établissement vous affecte un praticien ({specialite})</Text>
              </Pressable>
              {medecins.map((m) => (
                <Pressable key={m.id} onPress={() => setMedecin(m)} style={[s.pro, medecin?.id === m.id && s.proActif]}>
                  <Text style={s.titre}>{nomMedecin(m)}</Text>
                  <Text style={s.muted}>{m.specialite ?? "Médecine générale"}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}><FormField label="Date"><TextInput value={jour} onChangeText={(v) => setJour(formatDateDigits(v))} placeholder="JJ/MM/AAAA" placeholderTextColor={colors.textSubtle} maxLength={10} keyboardType="number-pad" style={inputStyle.base} /></FormField></View>
        <View style={{ width: 110 }}><FormField label="Heure"><TextInput value={heure} onChangeText={(v) => setHeure(formatHeureDigits(v))} placeholder="HH:MM" placeholderTextColor={colors.textSubtle} maxLength={5} keyboardType="number-pad" style={inputStyle.base} /></FormField></View>
      </View>
      <FormField label="Motif (facultatif)"><TextInput value={motif} onChangeText={setMotif} placeholder="ex. fièvre depuis 3 jours" placeholderTextColor={colors.textSubtle} style={inputStyle.base} /></FormField>
      <PrimaryButton label="Demander le rendez-vous" icon="send-outline" onPress={demander} loading={envoi} />
    </Screen>
  );
}

// ── Suivi de santé (constantes) ────────────────────────────────────────
export function SuiviSanteScreen() {
  const beneficiaires = useBeneficiaires();
  const [assureId, setAssureId] = useState("");
  const [mesures, setMesures] = useState<MesureSante[] | null>(null);
  const [type, setType] = useState("Tension");
  const [valeur, setValeur] = useState("");
  const charger = useCallback(() => { getMesMesures().then(setMesures).catch(() => setMesures([])); }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);

  const enregistrer = async () => {
    if (!valeur.trim()) return;
    try { await ajouterMesure({ assureId, type, valeur: valeur.trim(), unite: UNITE_MESURE[type] }); setValeur(""); charger(); }
    catch (err) { Alert.alert("Erreur", messageErreur(err)); }
  };
  const supprimer = (m: MesureSante) => Alert.alert("Supprimer cette mesure ?", `${m.type} : ${m.valeur}`, [
    { text: "Annuler", style: "cancel" }, { text: "Supprimer", style: "destructive", onPress: () => supprimerMesure(m.id).then(charger) },
  ]);
  const duBeneficiaire = (mesures ?? []).filter((m) => m.assureId === assureId);

  return (
    <Screen onRefresh={charger}>
      {beneficiaires.length > 1 ? <Puces libelle="Pour" options={beneficiaires.map((b) => ({ id: b.id, nom: b.vous ? `${b.nom} (vous)` : b.nom }))} valeur={assureId} onChange={setAssureId} /> : null}
      <Card>
        <Puces libelle="Nouvelle mesure" options={TYPES_MESURE.map((t) => ({ id: t, nom: t }))} valeur={type} onChange={setType} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <TextInput value={valeur} onChangeText={setValeur} placeholder={type === "Tension" ? "ex. 12/8" : `Valeur${UNITE_MESURE[type] ? ` (${UNITE_MESURE[type]})` : ""}`} placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { flex: 1 }]} />
          <View style={{ width: 130 }}><PrimaryButton label="Enregistrer" onPress={enregistrer} /></View>
        </View>
      </Card>
      {mesures === null ? <LoadingView /> : duBeneficiaire.length === 0 ? <EmptyState icon="pulse-outline" title="Aucune mesure" subtitle="Tension, glycémie, poids… : vos médecins autorisés les consultent dans votre dossier." /> : (
        TYPES_MESURE.map((t) => ({ t, l: duBeneficiaire.filter((m) => m.type === t) })).filter((g) => g.l.length).map((g) => (
          <Card key={g.t}>
            <Text style={s.titre}>{g.t} : {g.l[0].valeur} {g.l[0].unite ?? ""}</Text>
            {g.l.map((m) => (
              <Pressable key={m.id} onLongPress={() => !m.medecinId && supprimer(m)}>
                <Text style={s.muted}>{new Date(m.dateMesure).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {m.valeur} {m.unite ?? ""}{m.medecinId ? " · par votre médecin" : ""}</Text>
              </Pressable>
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}

// ── Accès au dossier médical ────────────────────────────────────────────
export function AccesDossierScreen() {
  const beneficiaires = useBeneficiaires();
  const [assureId, setAssureId] = useState("");
  const [acces, setAcces] = useState<AccesDossier[] | null>(null);
  const [medecin, setMedecin] = useState<Professionnel | null>(null);
  const charger = useCallback(() => { getAccesDossier().then(setAcces).catch(() => setAcces([])); }, []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { if (!assureId && beneficiaires[0]) setAssureId(beneficiaires[0].id); }, [beneficiaires, assureId]);

  const changer = async (assure: string, medecinId: string, ouvrir: boolean) => {
    try {
      await (ouvrir ? ouvrirAccesDossier(assure, medecinId) : fermerAccesDossier(assure, medecinId));
      Alert.alert(ouvrir ? "Accès ouvert" : "Accès fermé", "Le médecin a été prévenu.");
      setMedecin(null);
      charger();
    } catch (err) { Alert.alert("Erreur", messageErreur(err)); }
  };

  return (
    <Screen onRefresh={charger}>
      <Text style={[s.texte, { marginBottom: spacing.md }]}>Vous choisissez les médecins qui consultent votre dossier médical (consultations, ordonnances, examens, documents, constantes) et fermez l'accès quand vous voulez.</Text>
      <SectionTitle>Médecins autorisés</SectionTitle>
      {acces === null ? <LoadingView /> : acces.length === 0 ? <Text style={[s.muted, { marginBottom: spacing.md }]}>Aucun médecin n'a accès à votre dossier.</Text> : acces.map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name={a.actif ? "lock-open-outline" : "lock-closed-outline"} size={22} color={a.actif ? colors.success : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={s.titre}>{nomMedecin(a.medecin)}</Text>
              <Text style={s.muted}>Dossier de {a.assure.prenom ?? ""} {a.assure.nom} · {a.actif ? `ouvert le ${new Date(a.ouvertLe).toLocaleDateString("fr-FR")}` : `fermé le ${new Date(a.fermeLe!).toLocaleDateString("fr-FR")}`}</Text>
            </View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <PrimaryButton label={a.actif ? "Fermer l'accès" : "Rouvrir l'accès"} variant={a.actif ? "danger" : "outline"} onPress={() => changer(a.assureId, a.medecinId, !a.actif)} />
          </View>
        </Card>
      ))}
      <SectionTitle style={{ marginTop: spacing.md }}>Donner l'accès à un médecin</SectionTitle>
      {beneficiaires.length > 1 ? <Puces options={beneficiaires.map((b) => ({ id: b.id, nom: b.vous ? `${b.nom} (vous)` : b.nom }))} valeur={assureId} onChange={setAssureId} /> : null}
      <ChoixMedecin valeur={medecin} structure={null} onChange={(m) => setMedecin(m)} />
      {medecin ? <View style={{ marginTop: spacing.md }}><PrimaryButton label={`Ouvrir mon dossier à ${nomMedecin(medecin)}`} icon="lock-open-outline" onPress={() => changer(assureId, medecin.id, true)} /></View> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
  puces: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  puce: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  puceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  puceTexte: { fontSize: 13, color: colors.text },
  puceTexteActive: { color: "#fff", fontWeight: "600" },
  boutonPos: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  pro: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, marginBottom: 6, backgroundColor: colors.surface },
  proActif: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  structure: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, marginLeft: 26 },
  effacer: { position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center" },
  suggestions: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginTop: 4, backgroundColor: colors.surface },
  suggestion: { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  titre: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  texte: { fontSize: 13.5, color: colors.text },
  muted: { fontSize: 12.5, color: colors.textMuted },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
