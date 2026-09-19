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
  Screen, ScreenHeader, Card, SectionTitle, FormField, PrimaryButton, inputStyle, formatMontant,
} from "../../components/ui";
import { colors, spacing, radius } from "../../theme/colors";
import {
  getMesGaranties, creerAccordPrealable, uploaderDocumentAccordPrealable,
  type LigneAccordPrealableInput,
} from "../../api/portailMembre";
import { getReseauSoins, type PrestataireReseau } from "../../api/reseauSoins";
import { getActesMedicaux, type ActeMedical } from "../../api/actesMedicaux";
import { messageErreur, type RnFilePart } from "../../api/http";

// Nouvelle demande de prise en charge (route "AccordNouveau", sans params).
// Référence web : src/features/portail-membre/PriseEnCharge.tsx.
// Sélection d'actes FACULTATIVE (voir CreateAccordPrealableMembreDto côté
// backend : "la validation se fait côté assurance") — seule la présence de
// l'ordonnance OU du devis conditionne l'envoi.

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

export function PriseEnChargeNouveauScreen() {
  const navigation = useNavigation<NavPropAlias<RootStackParamList>>();

  const [categories, setCategories] = useState<string[]>([]);
  const [type, setType] = useState("");
  const [dateDemande, setDateDemande] = useState(todayFr());
  const [prestataireNom, setPrestataireNom] = useState("");
  const [prestataireId, setPrestataireId] = useState<string | undefined>(undefined);
  const [prestataires, setPrestataires] = useState<PrestataireReseau[]>([]);
  const [actes, setActes] = useState<ActeMedical[]>([]);
  const [lignes, setLignes] = useState<LigneAccordPrealableInput[]>([]);
  const [ordonnance, setOrdonnance] = useState<RnFilePart | null>(null);
  const [devis, setDevis] = useState<RnFilePart | null>(null);
  const [modalPrestataireVisible, setModalPrestataireVisible] = useState(false);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [modalActeVisible, setModalActeVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    getMesGaranties()
      .then((garanties) => {
        const cats = [...new Set(garanties.map((g) => g.categorie))];
        setCategories(cats);
        setType((v) => v || cats[0] || "");
      })
      .catch(() => undefined);
    getReseauSoins().then(setPrestataires).catch(() => undefined);
    getActesMedicaux().then(setActes).catch(() => undefined);
  }, []);

  const suggestionsPrestataires = useMemo(() => {
    const q = prestataireNom.trim().toLowerCase();
    if (!q) return [];
    return prestataires.filter((p) => p.nom.toLowerCase().includes(q) || (p.ville ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [prestataires, prestataireNom]);

  const ajouterActe = (acte: ActeMedical) => {
    setLignes((v) => [...v, {
      acteMedicalId: acte.id,
      lettreCleCode: acte.lettreCleCode ?? undefined,
      coefficient: acte.coefficient ?? undefined,
      description: acte.libelle,
      plafondReference: acte.prixDefaut,
      montantDevis: 0,
    }]);
    setModalActeVisible(false);
  };
  const retirerLigne = (i: number) => setLignes((v) => v.filter((_, idx) => idx !== i));
  const majMontantLigne = (i: number, montant: number) => setLignes((v) => v.map((l, idx) => (idx === i ? { ...l, montantDevis: montant } : l)));
  const totalDevis = lignes.reduce((s, l) => s + (l.montantDevis || 0), 0);

  const soumettre = async () => {
    setErreur(null);
    if (!prestataireNom.trim()) { setErreur("Le prestataire est obligatoire."); return; }
    if (!isValidFrDate(dateDemande)) { setErreur("La date de la demande est invalide."); return; }
    if (!type) { setErreur("Merci de choisir un type de garantie."); return; }
    if (!ordonnance && !devis) { setErreur("Merci de joindre l'ordonnance ou le devis."); return; }
    setEnvoi(true);
    try {
      const cree = await creerAccordPrealable({
        type,
        dateDemande,
        prestataire: prestataireNom.trim(),
        prestataireId,
        lignes: lignes.length > 0 ? lignes : undefined,
      });
      if (ordonnance) await uploaderDocumentAccordPrealable(cree.id, "ordonnance", ordonnance);
      if (devis) await uploaderDocumentAccordPrealable(cree.id, "devis", devis);
      Alert.alert("Demande envoyée", "Votre demande de prise en charge a bien été transmise.", [
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
      <ScreenHeader title="Nouvelle demande" subtitle="Prise en charge" />

      <SectionTitle>Type de garantie</SectionTitle>
      <Card>
        {categories.length === 0 ? (
          <Text style={styles.hint}>Chargement des garanties…</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {categories.map((c) => (
              <Pressable key={c} onPress={() => setType(c)} style={[styles.chip, type === c && styles.chipActive]}>
                <Text style={[styles.chipText, type === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      <SectionTitle>Prestataire</SectionTitle>
      <Card style={{ zIndex: 10 }}>
        <FormField label="Nom du prestataire *">
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              value={prestataireNom}
              onChangeText={(v) => { setPrestataireNom(v); setPrestataireId(undefined); setSuggestionsOuvertes(true); }}
              onFocus={() => setSuggestionsOuvertes(true)}
              placeholder="Nom du prestataire"
              style={[inputStyle.base, { flex: 1 }]}
            />
            <Pressable onPress={() => { setSuggestionsOuvertes(false); setModalPrestataireVisible(true); }} style={styles.searchBtn}>
              <Ionicons name="search" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </FormField>

        {/* Suggestions à la frappe (2026-09) — voir demande utilisateur :
            "la recherche d'un prestataire doit être intuitive et doit
            s'afficher par la saisie des lettres contenues dans le nom d'un
            prestataire" — même principe que les Combobox recherche-à-la-
            frappe côté web ([[feedback-listes-recherche-rapide]]). Ne
            remplace pas le bouton loupe (utile pour parcourir toute la
            liste sans rien taper), mais évite qu'il soit la SEULE façon de
            trouver un prestataire. */}
        {suggestionsOuvertes && prestataireNom.trim().length > 0 && !prestataireId ? (
          <View style={styles.suggestionsBox}>
            {suggestionsPrestataires.length === 0 ? (
              <Text style={styles.suggestionEmpty}>Aucun prestataire trouvé — vous pouvez saisir le nom librement.</Text>
            ) : (
              suggestionsPrestataires.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => { setPrestataireNom(p.nom); setPrestataireId(p.id); setSuggestionsOuvertes(false); }}
                  style={styles.suggestionItem}
                >
                  <Text style={styles.suggestionNom} numberOfLines={1}>{p.nom}</Text>
                  {p.ville ? <Text style={styles.suggestionVille} numberOfLines={1}>{p.ville}</Text> : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </Card>

      <SectionTitle>Date de la demande</SectionTitle>
      <Card>
        <FormField label="Date *">
          <TextInput
            value={dateDemande}
            onChangeText={(v) => setDateDemande(formatDateDigits(v))}
            placeholder="JJ/MM/AAAA"
            keyboardType="number-pad"
            style={inputStyle.base}
            maxLength={10}
          />
        </FormField>
      </Card>

      <SectionTitle>Actes du devis (facultatif)</SectionTitle>
      <Card>
        <Pressable onPress={() => setModalActeVisible(true)} style={styles.addActeBtn}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addActeText}>Ajouter un acte</Text>
        </Pressable>
        {lignes.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            {lignes.map((l, i) => (
              <View key={i} style={styles.ligneRow}>
                <Text style={styles.ligneLabel} numberOfLines={2}>{l.description}</Text>
                <TextInput
                  value={l.montantDevis ? String(l.montantDevis) : ""}
                  onChangeText={(v) => majMontantLigne(i, Number(v.replace(/[^\d]/g, "")) || 0)}
                  keyboardType="number-pad"
                  placeholder="Montant"
                  style={[inputStyle.base, styles.ligneMontantInput]}
                />
                <Pressable onPress={() => retirerLigne(i)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </Pressable>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total devis</Text>
              <Text style={styles.totalValue}>{formatMontant(totalDevis)}</Text>
            </View>
          </View>
        )}
      </Card>

      <SectionTitle>Documents</SectionTitle>
      <Card>
        <View style={styles.docRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>Ordonnance</Text>
            {ordonnance ? <Text style={styles.docNom} numberOfLines={1}>{ordonnance.name}</Text> : null}
          </View>
          <PrimaryButton label={ordonnance ? "Changer" : "Ajouter"} variant="outline" icon="cloud-upload-outline" onPress={async () => setOrdonnance(await choisirFichier())} />
        </View>
        <View style={[styles.docRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docLabel}>Devis</Text>
            {devis ? <Text style={styles.docNom} numberOfLines={1}>{devis.name}</Text> : null}
          </View>
          <PrimaryButton label={devis ? "Changer" : "Ajouter"} variant="outline" icon="cloud-upload-outline" onPress={async () => setDevis(await choisirFichier())} />
        </View>
        <Text style={styles.hint}>Ordonnance ou devis obligatoire pour envoyer la demande.</Text>
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
        onSelect={ajouterActe}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.textMuted },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  chipTextActive: { color: "#fff" },
  searchBtn: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  suggestionsBox: {
    marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    backgroundColor: colors.surface, overflow: "hidden",
  },
  suggestionItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestionNom: { fontSize: 13, fontWeight: "600", color: colors.text },
  suggestionVille: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  suggestionEmpty: { fontSize: 12, color: colors.textMuted, padding: 12 },
  addActeBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  addActeText: { fontSize: 13.5, fontWeight: "600", color: colors.primary },
  ligneRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  ligneLabel: { flex: 1, fontSize: 12.5, color: colors.text },
  ligneMontantInput: { width: 100, paddingVertical: 6, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8 },
  totalLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 13, fontWeight: "700", color: colors.text },
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
