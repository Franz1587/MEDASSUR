import { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput, Modal, FlatList, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp as NavPropAlias } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import type { RootStackParamList } from "../../navigation/types";
import {
  Screen, ScreenHeader, Card, SectionTitle, FormField, PrimaryButton, inputStyle,
} from "../../components/ui";
import { colors, spacing, radius } from "../../theme/colors";
import {
  creerRemboursement, uploaderDocumentRemboursement, getMoi, getMaFamille,
  type TypeDocumentRemboursement, type MembreIdentite, type MembreFamilleMembre,
} from "../../api/portailMembre";
import { getReseauSoins, type PrestataireReseau } from "../../api/reseauSoins";
import { getActesMedicaux, type ActeMedical } from "../../api/actesMedicaux";
import { messageErreur, type RnFilePart } from "../../api/http";

// Nouvelle demande de remboursement (route "RemboursementNouveau", sans
// params). Référence web : src/features/portail-membre/Remboursement.tsx.
// Seule la date est obligatoire côté backend (CreateRemboursementMembreDto)
// — prestataire/type/montant/acte sont des champs additionnels facultatifs,
// complétés par le gestionnaire à l'examen des pièces jointes.

function formatDateDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = "";
  if (digits.length > 0) out += digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}
function todayFr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function isValidFrDate(v: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

async function choisirFichier(): Promise<RnFilePart | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Ajouter un document",
      "Photo prise sur le champ, ou fichier existant (PDF, image…).",
      [
        {
          text: "Prendre une photo",
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { resolve(null); return; }
            const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
            if (res.canceled || !res.assets?.[0]) { resolve(null); return; }
            const a = res.assets[0];
            resolve({ uri: a.uri, name: a.fileName ?? `photo-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg" });
          },
        },
        {
          text: "Choisir un fichier",
          onPress: async () => {
            const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (res.canceled || !res.assets?.[0]) { resolve(null); return; }
            const a = res.assets[0];
            resolve({ uri: a.uri, name: a.name ?? `document-${Date.now()}`, type: a.mimeType ?? "application/octet-stream" });
          },
        },
        { text: "Annuler", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    );
  });
}

// Modal de recherche générique (façon Combobox web) — filtre côté client
// une liste déjà chargée (prestataires du réseau ou catalogue d'actes).
function RechercheModal<T>({
  visible, title, items, placeholder, getId, getLabel, getSubLabel, onClose, onSelect,
}: {
  visible: boolean;
  title: string;
  items: T[];
  placeholder: string;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | null | undefined;
  onClose: () => void;
  onSelect: (item: T) => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);
  const filtres = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((it) => getLabel(it).toLowerCase().includes(q) || (getSubLabel?.(it) ?? "").toLowerCase().includes(q))
      : items;
    return base.slice(0, 100);
  }, [items, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={modalStyles.searchWrap}>
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder={placeholder} style={inputStyle.base} />
        </View>
        <FlatList
          data={filtres}
          keyExtractor={getId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          ListEmptyComponent={<Text style={modalStyles.empty}>Aucun résultat.</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelect(item)} style={modalStyles.item}>
              <Text style={modalStyles.itemLabel}>{getLabel(item)}</Text>
              {getSubLabel?.(item) ? <Text style={modalStyles.itemSub}>{getSubLabel(item)}</Text> : null}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

interface DocSlot { cle: TypeDocumentRemboursement; label: string }
const SLOTS: DocSlot[] = [
  { cle: "prescription", label: "Prescription médicale" },
  { cle: "facture", label: "Facture normalisée" },
  { cle: "quittance", label: "Quittance laboratoire" },
  { cle: "autre", label: "Autre document" },
];

export function RemboursementNouveauScreen() {
  const navigation = useNavigation<NavPropAlias<RootStackParamList>>();

  const [date, setDate] = useState(todayFr());
  const [prestataireNom, setPrestataireNom] = useState("");
  const [prestataireId, setPrestataireId] = useState<string | undefined>(undefined);
  const [acteChoisi, setActeChoisi] = useState<ActeMedical | null>(null);
  const [montant, setMontant] = useState("");
  const [prestataires, setPrestataires] = useState<PrestataireReseau[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [fichiers, setFichiers] = useState<Partial<Record<TypeDocumentRemboursement, RnFilePart>>>({});
  const [modalPrestataireVisible, setModalPrestataireVisible] = useState(false);
  const [modalActeVisible, setModalActeVisible] = useState(false);
  const [suggestionsPrestataireOuvertes, setSuggestionsPrestataireOuvertes] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  // Bénéficiaire réel des frais (2026-09) — voir demande utilisateur : "on
  // puisse clairement indiquer pour qui dans la famille on a engagé les
  // frais, l'assuré principal ou un ayant droit".
  const [moi, setMoi] = useState<MembreIdentite | null>(null);
  const [famille, setFamille] = useState<MembreFamilleMembre[]>([]);
  const [beneficiaireId, setBeneficiaireId] = useState<string | undefined>(undefined);

  useEffect(() => {
    getReseauSoins().then(setPrestataires).catch(() => undefined);
    getActesMedicaux().then(setActes).catch(() => undefined);
    getMoi().then((m) => { setMoi(m); setBeneficiaireId((v) => v ?? m.id); }).catch(() => undefined);
    getMaFamille().then(setFamille).catch(() => undefined);
  }, []);

  const suggestionsPrestataires = useMemo(() => {
    const q = prestataireNom.trim().toLowerCase();
    if (!q) return [];
    return prestataires.filter((p) => p.nom.toLowerCase().includes(q) || (p.ville ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [prestataires, prestataireNom]);

  const soumettre = async () => {
    setErreur(null);
    if (!isValidFrDate(date)) { setErreur("La date est invalide."); return; }
    if (Object.keys(fichiers).length === 0) { setErreur("Merci de joindre au moins un justificatif."); return; }
    setEnvoi(true);
    try {
      const cree = await creerRemboursement({
        date,
        prestataire: prestataireNom.trim() || undefined,
        prestataireId,
        type: acteChoisi?.libelle,
        acteMedicalId: acteChoisi?.id,
        montant: montant ? Number(montant) : undefined,
        beneficiaireId,
      });
      await Promise.all(
        SLOTS.filter((s) => fichiers[s.cle]).map((s) => uploaderDocumentRemboursement(cree.id, s.cle, fichiers[s.cle]!)),
      );
      Alert.alert("Demande envoyée", "Votre demande de remboursement a bien été transmise.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setErreur(messageErreur(err, "Envoi impossible."));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Nouvelle demande" subtitle="Remboursement" />

      {famille.length > 0 && moi ? (
        <>
          <SectionTitle>Frais engagés pour</SectionTitle>
          <Card>
            <View style={styles.chipsWrap}>
              {[{ id: moi.id, nom: `${moi.nom} ${moi.prenom ?? ""}`.trim() + " (vous)" }, ...famille.map((f) => ({ id: f.id, nom: `${f.nom} ${f.prenom ?? ""}`.trim() }))].map((p) => (
                <Pressable key={p.id} onPress={() => setBeneficiaireId(p.id)} style={[styles.chip, beneficiaireId === p.id && styles.chipActive]}>
                  <Text style={[styles.chipText, beneficiaireId === p.id && styles.chipTextActive]}>{p.nom}</Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </>
      ) : null}

      <SectionTitle>Date du sinistre</SectionTitle>
      <Card>
        <FormField label="Date *">
          <TextInput
            value={date}
            onChangeText={(v) => setDate(formatDateDigits(v))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
            style={inputStyle.base}
            maxLength={10}
          />
        </FormField>
      </Card>

      <SectionTitle>Détails (facultatif)</SectionTitle>
      <Card>
        <FormField label="Acte / soin">
          <Pressable onPress={() => setModalActeVisible(true)} style={styles.selectField}>
            <Text style={acteChoisi ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
              {acteChoisi ? acteChoisi.libelle : "Rechercher un acte…"}
            </Text>
            <Ionicons name="search" size={16} color={colors.textMuted} />
          </Pressable>
        </FormField>
        <FormField label="Prestataire">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              value={prestataireNom}
              onChangeText={(v) => { setPrestataireNom(v); setPrestataireId(undefined); setSuggestionsPrestataireOuvertes(true); }}
              onFocus={() => setSuggestionsPrestataireOuvertes(true)}
              placeholder="Nom du prestataire"
              style={[inputStyle.base, { flex: 1 }]}
            />
            <Pressable onPress={() => { setSuggestionsPrestataireOuvertes(false); setModalPrestataireVisible(true); }} style={styles.searchBtn}>
              <Ionicons name="search" size={18} color={colors.primary} />
            </Pressable>
          </View>
          {suggestionsPrestataireOuvertes && prestataireNom.trim().length > 0 && !prestataireId ? (
            <View style={styles.suggestionsBox}>
              {suggestionsPrestataires.length === 0 ? (
                <Text style={styles.suggestionEmpty}>Aucun prestataire trouvé — vous pouvez saisir le nom librement.</Text>
              ) : (
                suggestionsPrestataires.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => { setPrestataireNom(p.nom); setPrestataireId(p.id); setSuggestionsPrestataireOuvertes(false); }}
                    style={styles.suggestionItem}
                  >
                    <Text style={styles.suggestionNom} numberOfLines={1}>{p.nom}</Text>
                    {p.ville ? <Text style={styles.suggestionVille} numberOfLines={1}>{p.ville}</Text> : null}
                  </Pressable>
                ))
              )}
            </View>
          ) : null}
        </FormField>
        <FormField label="Montant réel payé (FCFA)">
          <TextInput
            value={montant}
            onChangeText={(v) => setMontant(v.replace(/[^\d]/g, ""))}
            placeholder="0"
            keyboardType="number-pad"
            style={inputStyle.base}
          />
        </FormField>
      </Card>

      <SectionTitle>Pièces jointes</SectionTitle>
      <Card>
        {SLOTS.map((s, i) => (
          <View key={s.cle} style={[styles.docRow, i === SLOTS.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.docLabel}>{s.label}</Text>
              {fichiers[s.cle] ? <Text style={styles.docNom} numberOfLines={1}>{fichiers[s.cle]!.name}</Text> : null}
            </View>
            <PrimaryButton
              label={fichiers[s.cle] ? "Changer" : "Ajouter"}
              variant="outline"
              icon="cloud-upload-outline"
              onPress={async () => {
                const f = await choisirFichier();
                if (f) setFichiers((v) => ({ ...v, [s.cle]: f }));
              }}
            />
          </View>
        ))}
        <Text style={styles.hint}>Au moins un justificatif est obligatoire pour envoyer la demande.</Text>
      </Card>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

      <PrimaryButton label={envoi ? "Envoi…" : "Envoyer la demande"} onPress={soumettre} loading={envoi} icon="send" />

      <RechercheModal
        visible={modalPrestataireVisible}
        title="Choisir un prestataire"
        placeholder="Rechercher un prestataire…"
        items={prestataires}
        getId={(p) => p.id}
        getLabel={(p) => p.nom}
        getSubLabel={(p) => p.ville}
        onClose={() => setModalPrestataireVisible(false)}
        onSelect={(p) => {
          setPrestataireNom(p.nom);
          setPrestataireId(p.id);
          setModalPrestataireVisible(false);
        }}
      />
      <RechercheModal
        visible={modalActeVisible}
        title="Choisir un acte"
        placeholder="Rechercher un acte…"
        items={actes}
        getId={(a) => a.id}
        getLabel={(a) => a.libelle}
        getSubLabel={(a) => a.famille}
        onClose={() => setModalActeVisible(false)}
        onSelect={(a) => {
          setActeChoisi(a);
          setModalActeVisible(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.xs },
  searchBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  suggestionsBox: {
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, overflow: "hidden",
  },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionNom: { fontSize: 13, fontWeight: "600", color: colors.text },
  suggestionVille: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  suggestionEmpty: { fontSize: 12, color: colors.textMuted, padding: 12 },
  selectField: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface,
  },
  selectValue: { fontSize: 14.5, color: colors.text, flex: 1 },
  selectPlaceholder: { fontSize: 14.5, color: colors.textSubtle, flex: 1 },
  docRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  docLabel: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  docNom: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, maxWidth: 180 },
  erreur: { fontSize: 12.5, color: colors.danger, marginBottom: spacing.sm },
});

const modalStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  title: { fontSize: 16, fontWeight: "700", color: colors.text },
  searchWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl, fontSize: 13 },
  item: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
  itemSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
