import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { Card, EmptyState, ErrorView, inputStyle, ListRow, LoadingView, PrimaryButton, Screen, ScreenHeader, SectionTitle } from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { messageErreur } from "../../api/http";
import { useAuth } from "../../auth/AuthContext";
import {
  ajouterMesurePatient, cheminDocumentPatient, cheminFeuilleExamenPrescriptionMedecin, dateHeureFr, getDossierPatient, getPatientsPartages, getRendezVousMedecin, repondreRendezVousMedecin,
  TYPES_MESURE, UNITE_MESURE, versIso, type DossierPatient, type PatientPartage, type RendezVous,
} from "../../api/suiviSante";
import { BadgeRdv } from "../suiviSante/SuiviSanteScreens";
import { formatDateDigits, formatHeureDigits } from "../../utils/saisieDate";

// Espace médecin sur mobile (2026-11) — voir demande utilisateur : "les
// médecins doivent également avoir accès à leur portail via l'application
// mobile, recevoir des alertes lorsqu'un patient a été enregistré pour un
// rendez-vous avec lui… la date et l'heure du rendez-vous".
type Nav = NativeStackNavigationProp<RootStackParamList>;
const pad = (n: number) => String(n).padStart(2, "0");
const jourFr = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const heureFr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function useRendezVous() {
  const navigation = useNavigation<Nav>();
  const [liste, setListe] = useState<RendezVous[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = useCallback(() => { setErreur(null); getRendezVousMedecin().then(setListe).catch((e) => setErreur(messageErreur(e, "Chargement impossible."))); }, []);
  useEffect(() => navigation.addListener("focus", charger), [navigation, charger]);
  useEffect(() => { charger(); }, [charger]);
  return { liste, erreur, charger };
}

function CarteRendezVous({ r, onChange }: { r: RendezVous; onChange: () => void }) {
  const [edition, setEdition] = useState<"confirmer" | "refuser" | null>(null);
  const d = new Date(r.dateHeure);
  const [jour, setJour] = useState(jourFr(d));
  const [heure, setHeure] = useState(heureFr(d));
  const [message, setMessage] = useState("");

  const repondre = async (statut: "Confirmé" | "Refusé" | "Honoré" | "Absent") => {
    const dateHeure = statut === "Confirmé" ? versIso(jour, heure) : null;
    if (statut === "Confirmé" && !dateHeure) { Alert.alert("Date", "Saisissez la date (JJ/MM/AAAA) et l'heure (HH:MM)."); return; }
    if (statut === "Refusé" && !message.trim()) { Alert.alert("Motif", "Indiquez le motif du refus au patient."); return; }
    try {
      await repondreRendezVousMedecin(r.id, { statut, reponse: message.trim() || undefined, ...(dateHeure ? { dateHeure } : {}) });
      setEdition(null);
      onChange();
    } catch (err) { Alert.alert("Erreur", messageErreur(err)); }
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.titre}>{dateHeureFr(r.dateHeure)} · {r.type}{r.specialite ? ` · ${r.specialite}` : ""}</Text>
          <Text style={s.muted}>{r.assure.prenom ?? ""} {r.assure.nom} · {r.assure.matricule}{r.assure.telephone ? ` · ${r.assure.telephone}` : ""}</Text>
          {r.prestataire ? <Text style={s.muted}>{r.prestataire.nom}</Text> : null}
          {r.motif ? <Text style={s.texte}>Motif : {r.motif}</Text> : null}
          {r.reponse ? <Text style={s.muted}>Votre réponse : {r.reponse}</Text> : null}
        </View>
        <BadgeRdv statut={r.statut} />
      </View>
      {edition ? (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          {edition === "confirmer" ? (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TextInput value={jour} onChangeText={(v) => setJour(formatDateDigits(v))} placeholder="JJ/MM/AAAA" placeholderTextColor={colors.textSubtle} maxLength={10} style={[inputStyle.base, { flex: 1 }]} keyboardType="number-pad" accessibilityLabel="Date" />
              <TextInput value={heure} onChangeText={(v) => setHeure(formatHeureDigits(v))} placeholder="HH:MM" placeholderTextColor={colors.textSubtle} maxLength={5} style={[inputStyle.base, { width: 90 }]} keyboardType="number-pad" accessibilityLabel="Heure" />
            </View>
          ) : null}
          <TextInput value={message} onChangeText={setMessage} placeholder={edition === "refuser" ? "Motif du refus (envoyé au patient)" : "Message au patient (facultatif)"} placeholderTextColor={colors.textSubtle} style={inputStyle.base} />
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={{ flex: 1 }}><PrimaryButton label="Annuler" variant="outline" onPress={() => setEdition(null)} /></View>
            <View style={{ flex: 1 }}><PrimaryButton label={edition === "confirmer" ? "Confirmer" : "Refuser"} variant={edition === "confirmer" ? "primary" : "danger"} onPress={() => repondre(edition === "confirmer" ? "Confirmé" : "Refusé")} /></View>
          </View>
        </View>
      ) : r.statut === "Demandé" ? (
        <View style={s.actions}>
          <View style={{ flex: 1 }}><PrimaryButton label="Confirmer" onPress={() => setEdition("confirmer")} /></View>
          <View style={{ flex: 1 }}><PrimaryButton label="Refuser" variant="outline" onPress={() => setEdition("refuser")} /></View>
        </View>
      ) : r.statut === "Confirmé" ? (
        <View style={s.actions}>
          <Pressable onPress={() => setEdition("confirmer")}><Text style={s.lien}>Déplacer</Text></Pressable>
          <Pressable onPress={() => repondre("Honoré")}><Text style={s.lien}>Patient venu</Text></Pressable>
          <Pressable onPress={() => repondre("Absent")}><Text style={s.lien}>Absent</Text></Pressable>
        </View>
      ) : null}
    </Card>
  );
}

export function MedecinAccueilScreen() {
  const { currentUser } = useAuth();
  const { liste, erreur, charger } = useRendezVous();
  const [patients, setPatients] = useState<PatientPartage[]>([]);
  useEffect(() => { getPatientsPartages().then(setPatients).catch(() => undefined); }, [liste]);
  const aujourdhui = jourFr(new Date());
  const duJour = (liste ?? []).filter((r) => r.statut === "Confirmé" && jourFr(new Date(r.dateHeure)) === aujourdhui);
  const aTraiter = (liste ?? []).filter((r) => r.statut === "Demandé");
  return (
    <Screen onRefresh={charger}>
      <ScreenHeader title={`Bonjour ${currentUser?.nom ?? ""}`} subtitle="Votre espace médecin" />
      <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md }}>
        {[["À traiter", aTraiter.length, "alert-circle-outline"], ["Aujourd'hui", duJour.length, "today-outline"], ["Dossiers partagés", patients.length, "folder-open-outline"]].map(([l, n, i]) => (
          <Card key={l as string} style={{ flex: 1, alignItems: "center", paddingVertical: spacing.md }}>
            <Ionicons name={i as keyof typeof Ionicons.glyphMap} size={20} color={colors.primary} />
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{n as number}</Text>
            <Text style={[s.muted, { textAlign: "center" }]}>{l as string}</Text>
          </Card>
        ))}
      </View>
      {erreur && !liste ? <ErrorView message={erreur} onRetry={charger} /> : !liste ? <LoadingView /> : (
        <>
          <SectionTitle>Demandes à traiter</SectionTitle>
          {aTraiter.length === 0 ? <Text style={[s.muted, { marginBottom: spacing.md }]}>Aucune demande en attente.</Text> : aTraiter.map((r) => <CarteRendezVous key={r.id} r={r} onChange={charger} />)}
          <SectionTitle>Aujourd'hui</SectionTitle>
          {duJour.length === 0 ? <Text style={s.muted}>Aucun rendez-vous confirmé aujourd'hui.</Text> : duJour.map((r) => <CarteRendezVous key={r.id} r={r} onChange={charger} />)}
        </>
      )}
    </Screen>
  );
}

export function MedecinRendezVousScreen() {
  const { liste, erreur, charger } = useRendezVous();
  const [onglet, setOnglet] = useState<"traiter" | "venir" | "passes">("traiter");
  const limite = Date.now() - 3600_000;
  const groupes = {
    traiter: (liste ?? []).filter((r) => r.statut === "Demandé"),
    venir: (liste ?? []).filter((r) => r.statut === "Confirmé" && new Date(r.dateHeure).getTime() > limite),
    passes: (liste ?? []).filter((r) => r.statut !== "Demandé" && !(r.statut === "Confirmé" && new Date(r.dateHeure).getTime() > limite)).reverse(),
  };
  return (
    <Screen onRefresh={charger}>
      <ScreenHeader title="Rendez-vous" />
      <View style={s.onglets}>
        {([["traiter", "À traiter"], ["venir", "À venir"], ["passes", "Passés"]] as const).map(([o, l]) => (
          <Pressable key={o} onPress={() => setOnglet(o)} style={[s.onglet, onglet === o && s.ongletActif]}>
            <Text style={[s.ongletTexte, onglet === o && s.ongletTexteActif]}>{l}{o !== "passes" && groupes[o].length ? ` (${groupes[o].length})` : ""}</Text>
          </Pressable>
        ))}
      </View>
      {erreur && !liste ? <ErrorView message={erreur} onRetry={charger} /> : !liste ? <LoadingView />
        : groupes[onglet].length === 0 ? <EmptyState icon="calendar-outline" title="Aucun rendez-vous" />
        : groupes[onglet].map((r) => <CarteRendezVous key={r.id} r={r} onChange={charger} />)}
    </Screen>
  );
}

export function MedecinPatientsScreen() {
  const navigation = useNavigation<Nav>();
  const [patients, setPatients] = useState<PatientPartage[] | null>(null);
  const charger = useCallback(() => { getPatientsPartages().then(setPatients).catch(() => setPatients([])); }, []);
  useEffect(() => navigation.addListener("focus", charger), [navigation, charger]);
  useEffect(() => { charger(); }, [charger]);
  return (
    <Screen onRefresh={charger}>
      <ScreenHeader title="Dossiers patients" subtitle="Dossiers que vos patients vous ont ouverts" />
      {patients === null ? <LoadingView /> : patients.length === 0 ? <EmptyState icon="folder-open-outline" title="Aucun dossier partagé" subtitle="Un patient vous ouvre son dossier depuis son application ; vous êtes alors notifié." /> : (
        <Card style={{ padding: 0 }}><View style={{ paddingHorizontal: 16 }}>
          {patients.map((p) => (
            <ListRow key={p.id} icon="person-outline" label={`${p.prenom ?? ""} ${p.nom}`.trim()} sublabel={`${p.matricule} · ouvert le ${new Date(p.accesDepuis).toLocaleDateString("fr-FR")}`}
              onPress={() => navigation.navigate("MedecinDossier", { assureId: p.id, nom: `${p.prenom ?? ""} ${p.nom}`.trim() })} />
          ))}
        </View></Card>
      )}
    </Screen>
  );
}

export function MedecinDossierScreen() {
  const navigation = useNavigation<Nav>();
  const { assureId } = useRoute<RouteProp<RootStackParamList, "MedecinDossier">>().params;
  const [dossier, setDossier] = useState<DossierPatient | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [type, setType] = useState("Tension");
  const [valeur, setValeur] = useState("");
  const charger = useCallback(() => {
    getDossierPatient(assureId).then(setDossier).catch((e) => setErreur(/403/.test(String((e as Error).message)) ? "Le patient a fermé l'accès à son dossier." : messageErreur(e)));
  }, [assureId]);
  useEffect(() => { charger(); }, [charger]);

  const ajouter = async () => {
    if (!valeur.trim()) return;
    try { await ajouterMesurePatient(assureId, { type, valeur: valeur.trim(), unite: UNITE_MESURE[type] }); setValeur(""); charger(); }
    catch (err) { Alert.alert("Erreur", messageErreur(err)); }
  };

  if (erreur) return <Screen><ErrorView message={erreur} onRetry={charger} /></Screen>;
  if (!dossier) return <Screen><LoadingView /></Screen>;
  const a = dossier.assure;
  return (
    <Screen onRefresh={charger}>
      <Card>
        <Text style={s.titre}>{a.prenom ?? ""} {a.nom}</Text>
        <Text style={s.muted}>{a.matricule}{a.dateNaissance ? ` · né(e) le ${a.dateNaissance}` : ""}{a.groupeSanguin ? ` · groupe ${a.groupeSanguin}` : ""}</Text>
        <Text style={s.texte}>Allergies : {a.allergies.join(", ") || "—"}</Text>
        <Text style={s.texte}>Antécédents : {a.antecedentsMedicaux.join(", ") || "—"}</Text>
        <Text style={s.texte}>Traitements en cours : {a.traitementsEnCours.join(", ") || "—"}</Text>
      </Card>
      <SectionTitle>Constantes</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {TYPES_MESURE.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[s.puce, type === t && s.puceActive]}><Text style={[s.puceTexte, type === t && { color: "#fff" }]}>{t}</Text></Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
          <TextInput value={valeur} onChangeText={setValeur} placeholder={`Valeur${UNITE_MESURE[type] ? ` (${UNITE_MESURE[type]})` : ""}`} placeholderTextColor={colors.textSubtle} style={[inputStyle.base, { flex: 1 }]} />
          <View style={{ width: 110 }}><PrimaryButton label="Ajouter" onPress={ajouter} /></View>
        </View>
        {dossier.mesures.length === 0 ? <Text style={s.muted}>Aucune mesure.</Text> : dossier.mesures.slice(0, 20).map((m) => (
          <Text key={m.id} style={s.muted}>{new Date(m.dateMesure).toLocaleDateString("fr-FR")} · {m.type} : {m.valeur} {m.unite ?? ""}</Text>
        ))}
      </Card>
      <SectionTitle>Ordonnances et bons</SectionTitle>
      {dossier.prescriptions.length === 0 ? <Text style={s.muted}>Aucune.</Text> : dossier.prescriptions.map((p) => {
        const aExamen = p.lignes.some((l) => l.type === "Examen");
        return (
          <Card key={p.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.titre}>{p.date} · {p.prescripteur}</Text>
                {p.origine === "Numérisée" ? <Text style={s.muted}>Bon papier numérisé par le patient</Text> : null}
                {p.lignes.map((l, i) => <Text key={i} style={s.texte}>{l.type === "Examen" ? "Examen" : "Médicament"} : {l.libelle} × {l.quantite}{l.posologie ? ` — ${l.posologie}` : ""}</Text>)}
              </View>
              {aExamen ? (
                <Pressable onPress={() => navigation.navigate("DocumentViewer", { path: cheminFeuilleExamenPrescriptionMedecin(a.id, p.id), titre: "Feuille d'examen" })}
                  style={{ padding: 6 }} accessibilityLabel="Voir la feuille d'examen">
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}
      <SectionTitle>Consultations</SectionTitle>
      <Card>{dossier.consultations.length === 0 ? <Text style={s.muted}>Aucune.</Text> : dossier.consultations.slice(0, 40).map((c) => (
        <Text key={c.id} style={s.muted}>{c.date} · {c.acte ?? c.type}{c.structure ? ` — ${c.structure}` : ""}</Text>
      ))}</Card>
      <SectionTitle>Documents du carnet</SectionTitle>
      <Card style={{ padding: 0 }}><View style={{ paddingHorizontal: 16 }}>
        {dossier.documents.length === 0 ? <Text style={[s.muted, { paddingVertical: 12 }]}>Aucun document.</Text> : dossier.documents.map((d) => (
          <ListRow key={d.id} icon="document-text-outline" label={d.libelle || d.rubrique} sublabel={new Date(d.dateAjout).toLocaleDateString("fr-FR")}
            onPress={() => navigation.navigate("DocumentViewer", { path: cheminDocumentPatient(assureId, d.id), titre: d.libelle || d.rubrique })} />
        ))}
      </View></Card>
    </Screen>
  );
}

export function MedecinPlusScreen() {
  const navigation = useNavigation<Nav>();
  const { currentUser, logout } = useAuth();
  return (
    <Screen>
      <ScreenHeader title="Plus" subtitle={currentUser?.nom} />
      <Card style={{ padding: 0 }}><View style={{ paddingHorizontal: 16 }}>
        <ListRow icon="chatbubbles-outline" label="Messagerie" onPress={() => navigation.navigate("MessagerieListe")} />
        <ListRow icon="log-out-outline" label="Déconnexion" iconColor="#dc2626" onPress={() => logout()} />
      </View></Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  titre: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  texte: { fontSize: 13.5, color: colors.text, marginTop: 2 },
  muted: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  lien: { color: colors.primary, fontWeight: "600", fontSize: 13.5 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm, alignItems: "center" },
  onglets: { flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: 4, marginBottom: spacing.md },
  onglet: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: "center" },
  ongletActif: { backgroundColor: colors.surface },
  ongletTexte: { fontSize: 13, color: colors.textMuted },
  ongletTexteActif: { color: colors.text, fontWeight: "700" },
  puce: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  puceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  puceTexte: { fontSize: 12.5, color: colors.text },
});
