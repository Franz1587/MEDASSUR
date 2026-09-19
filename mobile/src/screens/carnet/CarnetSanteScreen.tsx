import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  ScreenHeader, Card, SectionTitle, Badge, statutVariant, PrimaryButton,
  EmptyState, LoadingView, ErrorView, FormField, inputStyle, formatDate,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import {
  getMoi, modifierInformationsMedicales, getMaFamille, getCarnetSante, ajouterCarnetSante,
  supprimerCarnetSante, urlCarnetSante, cheminFeuilleSoins, cheminFeuilleExamenBon,
  type MembreIdentite, type RubriqueCarnetSante, type CarnetSanteDocument,
} from "../../api/portailMembre";
import { messageErreur, type RnFilePart } from "../../api/http";

// E-carnet Santé — MÊME logique que src/features/portail-membre/CarnetSante.tsx
// + InformationsMedicalesCard.tsx (web) : bloc "informations médicales"
// d'urgence auto-déclaratif en haut (nom de section imposé, voir mémoire
// projet — nom de produit concurrent interdit), documents groupés par
// rubrique (Ordonnance/Examens) en dessous. Même endpoint que le web
// (PATCH /portail-membre/informations-medicales) — vérifié en prod (200,
// déjà déployé côté backend).
const RUBRIQUES: { cle: RubriqueCarnetSante; label: string }[] = [
  { cle: "Ordonnance", label: "Ordonnance" },
  { cle: "Examens", label: "Examens & Compte rendu" },
];

function ListeModifiable({
  titre, valeurs, onChange, placeholder,
}: { titre: string; valeurs: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [saisie, setSaisie] = useState("");
  const ajouter = () => {
    const v = saisie.trim();
    if (!v) return;
    onChange([...valeurs, v]);
    setSaisie("");
  };
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{titre}</Text>
      <View style={styles.chipsWrap}>
        {valeurs.map((v, i) => (
          <View key={`${v}-${i}`} style={styles.editChip}>
            <Text style={styles.editChipText}>{v}</Text>
            <Pressable onPress={() => onChange(valeurs.filter((_, j) => j !== i))} hitSlop={6}>
              <Ionicons name="close" size={13} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
        {valeurs.length === 0 ? <Text style={styles.noneText}>Aucun renseigné.</Text> : null}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={saisie}
          onChangeText={setSaisie}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          style={[inputStyle.base, { flex: 1 }]}
          onSubmitEditing={ajouter}
          returnKeyType="done"
        />
        <Pressable onPress={ajouter} style={styles.addBtn}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export function CarnetSanteScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [moiError, setMoiError] = useState<string | null>(null);
  const [beneficiaires, setBeneficiaires] = useState<{ id: string; nom: string }[]>([]);
  const [beneficiaireId, setBeneficiaireId] = useState<string | null>(null);

  const [edition, setEdition] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupeSanguin, setGroupeSanguin] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [antecedentsMedicaux, setAntecedentsMedicaux] = useState<string[]>([]);
  const [traitementsEnCours, setTraitementsEnCours] = useState<string[]>([]);
  const [contactUrgenceNom, setContactUrgenceNom] = useState("");
  const [contactUrgenceTelephone, setContactUrgenceTelephone] = useState("");

  const [rubrique, setRubrique] = useState<RubriqueCarnetSante>("Ordonnance");
  const [documents, setDocuments] = useState<CarnetSanteDocument[] | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState<string | null>(null);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const chargerDepuis = (m: MembreIdentite) => {
    setMoi(m);
    setGroupeSanguin(m.groupeSanguin ?? "");
    setAllergies(m.allergies ?? []);
    setAntecedentsMedicaux(m.antecedentsMedicaux ?? []);
    setTraitementsEnCours(m.traitementsEnCours ?? []);
    setContactUrgenceNom(m.contactUrgenceNom ?? "");
    setContactUrgenceTelephone(m.contactUrgenceTelephone ?? "");
  };

  const chargerMoi = useCallback(async () => {
    setMoiError(null);
    try {
      const m = await getMoi();
      chargerDepuis(m);
      setBeneficiaireId((prev) => prev ?? m.id);
      try {
        const famille = await getMaFamille();
        setBeneficiaires([
          { id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() },
          ...famille.map((f) => ({ id: f.id, nom: `${f.nom} ${f.prenom ?? ""}`.trim() })),
        ]);
      } catch {
        setBeneficiaires([{ id: m.id, nom: `${m.nom} ${m.prenom ?? ""}`.trim() }]);
      }
    } catch (err) {
      setMoiError(messageErreur(err, "Impossible de charger vos informations."));
    }
  }, []);

  const chargerDocuments = useCallback(async (rub: RubriqueCarnetSante) => {
    setDocLoading(true);
    setDocError(null);
    try {
      const data = await getCarnetSante(rub);
      setDocuments(data);
    } catch (err) {
      setDocuments(null);
      setDocError(messageErreur(err, "Impossible de charger cette rubrique."));
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => { chargerMoi(); }, [chargerMoi]);
  useEffect(() => { chargerDocuments(rubrique); }, [rubrique, chargerDocuments]);

  const rienRenseigne = !!moi && !moi.groupeSanguin && !moi.allergies?.length && !moi.antecedentsMedicaux?.length
    && !moi.traitementsEnCours?.length && !moi.contactUrgenceNom;

  const annulerEdition = () => {
    if (moi) chargerDepuis(moi);
    setEdition(false);
  };

  const enregistrerInfos = async () => {
    setSaving(true);
    try {
      const m = await modifierInformationsMedicales({
        groupeSanguin: groupeSanguin.trim() || undefined,
        allergies, antecedentsMedicaux, traitementsEnCours,
        contactUrgenceNom: contactUrgenceNom.trim() || undefined,
        contactUrgenceTelephone: contactUrgenceTelephone.trim() || undefined,
      });
      chargerDepuis(m);
      setEdition(false);
    } catch (err) {
      Alert.alert("Erreur", messageErreur(err, "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  };

  const envoyerAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setEnvoi(true);
    try {
      const file: RnFilePart = {
        uri: asset.uri,
        name: asset.fileName ?? `carnet-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      await ajouterCarnetSante(rubrique, file, { assureId: beneficiaireId ?? undefined, libelle: libelle.trim() || undefined });
      setLibelle("");
      setAjoutOuvert(false);
      chargerDocuments(rubrique);
    } catch (err) {
      Alert.alert("Erreur", messageErreur(err, "Envoi du document impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  const prendrePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission requise", "L'accès à la caméra est nécessaire pour photographier un document.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets[0]) await envoyerAsset(res.assets[0]);
  };

  const choisirGalerie = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission requise", "L'accès à vos photos est nécessaire pour joindre un document.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (!res.canceled && res.assets[0]) await envoyerAsset(res.assets[0]);
  };

  const choisirSource = () => {
    Alert.alert("Ajouter un document", "Photographiez le document ou choisissez-le dans votre galerie.", [
      { text: "Prendre une photo", onPress: prendrePhoto },
      { text: "Choisir dans la galerie", onPress: choisirGalerie },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const supprimer = (id: string) => {
    Alert.alert("Supprimer ce document ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await supprimerCarnetSante(id);
            chargerDocuments(rubrique);
          } catch (err) {
            Alert.alert("Erreur", messageErreur(err, "Suppression impossible."));
          }
        },
      },
    ]);
  };

  // Ouverture dans l'application (2026-09) — voir demande utilisateur : "il
  // faut normalement que lorsqu'on clique ici le document s'ouvre dans
  // l'application et non hors de l'application". Navigue vers la
  // visionneuse intégrée plutôt que de télécharger/partager systématiquement.
  const ouvrir = (d: CarnetSanteDocument) => {
    if (d.source === "upload") {
      if (d.fichier) navigation.navigate("DocumentViewer", { path: urlCarnetSante(d.fichier), titre: d.numero ?? "Document" });
      return;
    }
    if (d.rubrique === "Ordonnance" && d.priseEnChargeId) {
      navigation.navigate("DocumentViewer", { path: cheminFeuilleSoins(d.priseEnChargeId), titre: d.numero ?? "Ordonnance" });
    } else if (d.prescriptionId) {
      navigation.navigate("DocumentViewer", { path: cheminFeuilleExamenBon(d.prescriptionId), titre: d.numero ?? "Examen" });
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ScreenHeader title="E-carnet Santé" subtitle="Informations médicales, ordonnances et examens" />

      {/* Carte d'urgence — informations médicales */}
      <View style={styles.emergencyCard}>
        <View style={styles.emergencyHeader}>
          <Ionicons name="medkit-outline" size={18} color={colors.emergency} />
          <Text style={styles.emergencyTitle}>Informations médicales</Text>
        </View>

        {moiError && !moi ? (
          <ErrorView message={moiError} onRetry={chargerMoi} />
        ) : !moi ? (
          <LoadingView label="Chargement…" />
        ) : !edition ? (
          <>
            <Text style={styles.emergencySubtitle}>
              Fiche d'urgence consultable rapidement en cas de besoin — renseignée par vous-même.
            </Text>
            {rienRenseigne ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={styles.noneTextEmergency}>Aucune information renseignée pour l'instant.</Text>
                <View style={{ marginTop: spacing.md }}>
                  <PrimaryButton label="Ajouter mes informations médicales" icon="add" onPress={() => setEdition(true)} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.infoGrid}>
                  <Text style={styles.infoLine}><Text style={styles.infoLabel}>Groupe sanguin : </Text>{moi.groupeSanguin || "—"}</Text>
                  <Text style={styles.infoLine}>
                    <Text style={styles.infoLabel}>Contact d'urgence : </Text>
                    {moi.contactUrgenceNom ? `${moi.contactUrgenceNom}${moi.contactUrgenceTelephone ? " · " + moi.contactUrgenceTelephone : ""}` : "—"}
                  </Text>
                  <Text style={styles.infoLine}><Text style={styles.infoLabel}>Allergies : </Text>{moi.allergies?.length ? moi.allergies.join(", ") : "Aucune renseignée"}</Text>
                  <Text style={styles.infoLine}><Text style={styles.infoLabel}>Antécédents médicaux : </Text>{moi.antecedentsMedicaux?.length ? moi.antecedentsMedicaux.join(", ") : "Aucun renseigné"}</Text>
                  <Text style={styles.infoLine}><Text style={styles.infoLabel}>Traitements en cours : </Text>{moi.traitementsEnCours?.length ? moi.traitementsEnCours.join(", ") : "Aucun renseigné"}</Text>
                </View>
                <View style={{ marginTop: spacing.md, width: 140 }}>
                  <PrimaryButton label="Modifier" variant="outline" icon="pencil" onPress={() => setEdition(true)} />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <FormField label="Groupe sanguin">
              <TextInput value={groupeSanguin} onChangeText={setGroupeSanguin} placeholder="ex. O+" placeholderTextColor={colors.textSubtle} style={inputStyle.base} />
            </FormField>
            <FormField label="Contact d'urgence — nom">
              <TextInput value={contactUrgenceNom} onChangeText={setContactUrgenceNom} placeholder="Nom du proche à contacter" placeholderTextColor={colors.textSubtle} style={inputStyle.base} />
            </FormField>
            <FormField label="Contact d'urgence — téléphone">
              <TextInput value={contactUrgenceTelephone} onChangeText={setContactUrgenceTelephone} placeholder="+241 …" placeholderTextColor={colors.textSubtle} style={inputStyle.base} keyboardType="phone-pad" />
            </FormField>
            <ListeModifiable titre="Allergies" valeurs={allergies} onChange={setAllergies} placeholder="ex. Pénicilline" />
            <ListeModifiable titre="Antécédents médicaux" valeurs={antecedentsMedicaux} onChange={setAntecedentsMedicaux} placeholder="ex. Diabète type 2" />
            <ListeModifiable titre="Traitements en cours" valeurs={traitementsEnCours} onChange={setTraitementsEnCours} placeholder="ex. Metformine 500mg" />
            <View style={styles.editActions}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Annuler" variant="outline" onPress={annulerEdition} disabled={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Enregistrer" icon="checkmark" onPress={enregistrerInfos} loading={saving} />
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Rubriques du carnet */}
      <SectionTitle>Documents</SectionTitle>
      <View style={styles.tabsRow}>
        {RUBRIQUES.map((r) => (
          <Pressable key={r.cle} onPress={() => setRubrique(r.cle)} style={[styles.tab, rubrique === r.cle && styles.tabActive]}>
            <Text style={[styles.tabText, rubrique === r.cle && styles.tabTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      {ajoutOuvert ? (
        <Card>
          <Text style={styles.addTitle}>Ajouter un document — {rubrique === "Ordonnance" ? "Ordonnance" : "Examens & Compte rendu"}</Text>
          {beneficiaires.length > 1 ? (
            <View style={styles.chipsWrap}>
              {beneficiaires.map((b) => (
                <Pressable key={b.id} onPress={() => setBeneficiaireId(b.id)} style={[styles.beneficiaireChip, beneficiaireId === b.id && styles.beneficiaireChipActive]}>
                  <Text style={[styles.beneficiaireChipText, beneficiaireId === b.id && styles.beneficiaireChipTextActive]}>
                    {b.id === moi?.id ? `${b.nom} (vous)` : b.nom}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <TextInput
            value={libelle}
            onChangeText={setLibelle}
            placeholder="Description (facultatif)"
            placeholderTextColor={colors.textSubtle}
            style={[inputStyle.base, { marginTop: spacing.sm, marginBottom: spacing.md }]}
          />
          <PrimaryButton label={envoi ? "Envoi…" : "Photographier / choisir un fichier"} icon="camera-outline" onPress={choisirSource} loading={envoi} />
        </Card>
      ) : null}

      {docError && !documents ? (
        <ErrorView message={docError} onRetry={() => chargerDocuments(rubrique)} />
      ) : docLoading && !documents ? (
        <LoadingView label="Chargement des documents…" />
      ) : !documents || documents.length === 0 ? (
        <EmptyState icon="document-text-outline" title="Aucun document" subtitle="Aucun document dans cette rubrique pour l'instant." />
      ) : (
        documents.map((d) => (
          <Card key={d.id} style={styles.docCard}>
            <View style={styles.docIcon}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docTitle} numberOfLines={1}>{d.libelle || "Document"}</Text>
              {d.source === "feuille" ? (
                <Text style={styles.docSubtitle}>{d.numero} · {d.dateSoins} · {d.assureNom}</Text>
              ) : (
                <Text style={styles.docSubtitle}>{d.assureNom} · {formatDate(d.dateAjout)}</Text>
              )}
            </View>
            {d.statut ? <Badge label={d.statut === "NonTraite" ? "Non traité" : d.statut === "PartiellementTraite" ? "Partiel" : "Traité"} variant={statutVariant(d.statut)} /> : null}
            <Pressable onPress={() => ouvrir(d)} hitSlop={8} style={styles.docAction}>
              <Ionicons name="eye-outline" size={18} color={colors.primary} />
            </Pressable>
            {d.source === "upload" ? (
              <Pressable onPress={() => supprimer(d.id)} hitSlop={8} style={styles.docAction}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>

      <Pressable onPress={() => setAjoutOuvert((v) => !v)} style={styles.fab}>
        <Ionicons name={ajoutOuvert ? "close" : "add"} size={26} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  emergencyCard: {
    backgroundColor: colors.emergencyBg, borderWidth: 1, borderColor: colors.emergencyBorder,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
  },
  emergencyHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  emergencyTitle: { fontSize: 15, fontWeight: "700", color: colors.emergency },
  emergencySubtitle: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  noneTextEmergency: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  infoGrid: { gap: 6 },
  infoLine: { fontSize: 13, color: colors.text },
  infoLabel: { color: colors.textMuted },
  editActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  fieldLabel: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, marginBottom: 6 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  editChip: {
    flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill, paddingHorizontal: 10, height: 28,
  },
  editChipText: { fontSize: 12, color: colors.text },
  noneText: { fontSize: 12, color: colors.textSubtle, fontStyle: "italic" },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addBtn: {
    width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface,
  },
  tabsRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  tab: {
    flex: 1, height: 36, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: "#fff" },
  addTitle: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted, marginBottom: spacing.sm },
  beneficiaireChip: {
    paddingHorizontal: 12, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border,
  },
  beneficiaireChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  beneficiaireChipText: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  beneficiaireChipTextActive: { color: "#fff" },
  docCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  docIcon: {
    width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary + "1a",
    alignItems: "center", justifyContent: "center",
  },
  docTitle: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  docSubtitle: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  docAction: { padding: 4 },
  fab: {
    position: "absolute", right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
});
