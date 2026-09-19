import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TextInput, Image, Modal, Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import SignatureScreen, { type SignatureViewRef } from "react-native-signature-canvas";
import {
  Screen, ScreenHeader, Card, FormField, PrimaryButton, inputStyle, LoadingView, ErrorView,
} from "../../components/ui";
import { colors, radius, spacing } from "../../theme/colors";
import { useAuth } from "../../auth/AuthContext";
import { messageErreur, type RnFilePart } from "../../api/http";
import {
  getMoiCompte, modifierMonProfil, changerMonMotDePasse, signatureUrl, uploaderMaSignature, supprimerMaSignature,
  type UserAccount,
} from "../../api/profil";

// Mon profil — MÊME comportement que src/portals/MonProfilModal.tsx côté
// web : nom/téléphone/adresse modifiables (email lecture seule), changement
// de mot de passe (ancien + nouveau ≥ 8 caractères + confirmation), et
// signature électronique. Signature : pad tactile natif via
// react-native-signature-canvas (WebView interne, voir installation) — la
// capture PNG base64 est convertie en fichier temporaire
// (expo-file-system) puis envoyée à uploaderMaSignature().
async function dataUrlVersFichier(dataUrl: string): Promise<RnFilePart> {
  const correspondance = dataUrl.match(/^data:(.+);base64,(.*)$/);
  const mime = correspondance?.[1] ?? "image/png";
  const base64 = correspondance?.[2] ?? dataUrl;
  const extension = mime.includes("png") ? "png" : "jpg";
  const chemin = `${FileSystem.cacheDirectory}signature-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(chemin, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri: chemin, name: `signature.${extension}`, type: mime };
}

function SignaturePad({ onValider, onAnnuler }: { onValider: (dataUrl: string) => void; onAnnuler: () => void }) {
  const ref = useRef<SignatureViewRef>(null);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.padHeader}>
        <Text style={styles.padTitle}>Signez ci-dessous</Text>
      </View>
      <SignatureScreen
        ref={ref}
        onOK={onValider}
        descriptionText=""
        webStyle=".m-signature-pad--footer { display: none; margin: 0; } .m-signature-pad { box-shadow: none; border: none; }"
        backgroundColor="#ffffff"
        penColor={colors.primaryDark}
      />
      <View style={styles.padFooter}>
        <PrimaryButton label="Annuler" variant="outline" onPress={onAnnuler} />
        <View style={{ width: spacing.sm }} />
        <PrimaryButton label="Effacer" variant="outline" onPress={() => ref.current?.clearSignature()} />
        <View style={{ width: spacing.sm }} />
        <PrimaryButton label="Valider" onPress={() => ref.current?.readSignature()} />
      </View>
    </View>
  );
}

export function MonProfilScreen() {
  const { refreshCurrentUser, logout } = useAuth();
  const [compte, setCompte] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [saving, setSaving] = useState(false);

  const [ancienMdp, setAncienMdp] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmationMdp, setConfirmationMdp] = useState("");
  const [savingMdp, setSavingMdp] = useState(false);

  const [padVisible, setPadVisible] = useState(false);
  const [signatureEnCours, setSignatureEnCours] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getMoiCompte();
      setCompte(c);
      setNom(c.nom);
      setTelephone(c.telephone ?? "");
      setAdresse(c.adresse ?? "");
    } catch (err) {
      setError(messageErreur(err, "Impossible de charger votre profil."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const enregistrerProfil = async () => {
    if (!nom.trim()) { Alert.alert("Nom requis", "Le nom ne peut pas être vide."); return; }
    setSaving(true);
    try {
      const c = await modifierMonProfil({ nom: nom.trim(), telephone: telephone.trim() || undefined, adresse: adresse.trim() || undefined });
      setCompte(c);
      await refreshCurrentUser();
      Alert.alert("Profil mis à jour");
    } catch (err) {
      Alert.alert("Enregistrement impossible", messageErreur(err));
    } finally {
      setSaving(false);
    }
  };

  const changerMotDePasse = async () => {
    if (!ancienMdp || !nouveauMdp) { Alert.alert("Champs requis", "Renseignez votre mot de passe actuel et le nouveau."); return; }
    if (nouveauMdp.length < 8) { Alert.alert("Mot de passe trop court", "Le nouveau mot de passe doit contenir au moins 8 caractères."); return; }
    if (nouveauMdp !== confirmationMdp) { Alert.alert("Confirmation incorrecte", "La confirmation ne correspond pas au nouveau mot de passe."); return; }
    setSavingMdp(true);
    try {
      await changerMonMotDePasse(ancienMdp, nouveauMdp);
      setAncienMdp(""); setNouveauMdp(""); setConfirmationMdp("");
      Alert.alert("Mot de passe changé");
    } catch (err) {
      Alert.alert("Mot de passe actuel incorrect", messageErreur(err));
    } finally {
      setSavingMdp(false);
    }
  };

  const validerSignature = async (dataUrl: string) => {
    setSignatureEnCours(true);
    try {
      const fichier = await dataUrlVersFichier(dataUrl);
      const c = await uploaderMaSignature(fichier);
      setCompte(c);
      setPadVisible(false);
    } catch (err) {
      Alert.alert("Signature impossible", messageErreur(err));
    } finally {
      setSignatureEnCours(false);
    }
  };

  const supprimerSignature = () => {
    Alert.alert("Supprimer la signature", "Confirmer la suppression de votre signature ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive",
        onPress: async () => {
          setSuppressionEnCours(true);
          try {
            const c = await supprimerMaSignature();
            setCompte(c);
          } catch (err) {
            Alert.alert("Suppression impossible", messageErreur(err));
          } finally {
            setSuppressionEnCours(false);
          }
        },
      },
    ]);
  };

  if (loading && !compte) {
    return (
      <Screen>
        <ScreenHeader title="Mon profil" />
        <LoadingView label="Chargement de votre profil…" />
      </Screen>
    );
  }

  if (error && !compte) {
    return (
      <Screen>
        <ScreenHeader title="Mon profil" />
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  const urlSignature = signatureUrl(compte?.signature);

  return (
    <Screen>
      <ScreenHeader title="Mon profil" subtitle={compte?.email} />

      <Card>
        <FormField label="Nom *">
          <TextInput value={nom} onChangeText={setNom} style={inputStyle.base} placeholderTextColor={colors.textSubtle} />
        </FormField>
        <FormField label="Email">
          <TextInput value={compte?.email ?? ""} editable={false} style={[inputStyle.base, styles.disabled]} />
        </FormField>
        <FormField label="Téléphone">
          <TextInput value={telephone} onChangeText={setTelephone} style={inputStyle.base} placeholder="+241 …" keyboardType="phone-pad" placeholderTextColor={colors.textSubtle} />
        </FormField>
        <FormField label="Adresse">
          <TextInput value={adresse} onChangeText={setAdresse} style={inputStyle.base} placeholderTextColor={colors.textSubtle} />
        </FormField>
        <PrimaryButton label="Enregistrer" onPress={enregistrerProfil} loading={saving} icon="save-outline" />
      </Card>

      <Card>
        <Text style={styles.sectionTitre}>Changer de mot de passe</Text>
        <FormField label="Mot de passe actuel">
          <TextInput value={ancienMdp} onChangeText={setAncienMdp} style={inputStyle.base} secureTextEntry placeholderTextColor={colors.textSubtle} />
        </FormField>
        <FormField label="Nouveau mot de passe">
          <TextInput value={nouveauMdp} onChangeText={setNouveauMdp} style={inputStyle.base} secureTextEntry placeholderTextColor={colors.textSubtle} />
        </FormField>
        <FormField label="Confirmation">
          <TextInput value={confirmationMdp} onChangeText={setConfirmationMdp} style={inputStyle.base} secureTextEntry placeholderTextColor={colors.textSubtle} />
        </FormField>
        <PrimaryButton label="Changer le mot de passe" onPress={changerMotDePasse} loading={savingMdp} variant="outline" icon="key-outline" />
      </Card>

      <Card>
        <Text style={styles.sectionTitre}>Signature électronique</Text>
        {urlSignature ? (
          <>
            <Image source={{ uri: urlSignature }} style={styles.signatureImg} resizeMode="contain" />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Refaire la signature" variant="outline" onPress={() => setPadVisible(true)} icon="create-outline" />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Supprimer" variant="danger" loading={suppressionEnCours} onPress={supprimerSignature} icon="trash-outline" />
              </View>
            </View>
          </>
        ) : (
          <PrimaryButton label="Ajouter ma signature" onPress={() => setPadVisible(true)} icon="create-outline" />
        )}
      </Card>

      <View style={{ marginTop: spacing.sm }}>
        <PrimaryButton label="Déconnexion" variant="outline" icon="log-out-outline" onPress={() => logout()} />
      </View>

      <Modal visible={padVisible} animationType="slide" onRequestClose={() => setPadVisible(false)}>
        <SignaturePad
          onValider={validerSignature}
          onAnnuler={() => setPadVisible(false)}
        />
        {signatureEnCours ? (
          <View style={styles.overlay}>
            <LoadingView label="Enregistrement de la signature…" />
          </View>
        ) : null}
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
  sectionTitre: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  signatureImg: { width: "100%", height: 100, backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  padHeader: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  padTitle: { fontSize: 14, fontWeight: "700", color: colors.text, textAlign: "center" },
  padFooter: { flexDirection: "row", padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center",
  },
});
