import React, { useEffect, useState } from "react";
import { View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Screen, ScreenHeader, Card, ListRow } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { getMembreDashboard } from "../../api/portailMembre";
import type { RootStackParamList } from "../../navigation/types";

// "Plus" — regroupe les rubriques du portail web qui ne tiennent pas dans
// la barre d'onglets (5 max) : Ma carte, Mes garanties, Réseau
// de soins, Historique de soins, Ma famille, Accès famille (assuré
// PRINCIPAL uniquement — voir estAssurePrincipal renvoyé par
// GET /portail-membre/dashboard), Messagerie, Mon profil.
export function PlusMenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, logout } = useAuth();
  const [estAssurePrincipal, setEstAssurePrincipal] = useState(false);

  useEffect(() => {
    getMembreDashboard().then((d) => setEstAssurePrincipal(d.estAssurePrincipal)).catch(() => undefined);
  }, []);

  return (
    <Screen>
      <ScreenHeader title="Plus" subtitle={currentUser?.nom} />

      <Card style={{ padding: 0 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="card-outline" label="Ma carte" onPress={() => navigation.navigate("CarteMembre", { assureId: currentUser?.assureSanteId ?? "", nom: currentUser?.nom ?? "" })} />
          <ListRow icon="shield-checkmark-outline" label="Mes garanties" onPress={() => navigation.navigate("Garanties")} />
        </View>
      </Card>

      <Card style={{ padding: 0, marginTop: 4 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="map-outline" label="Réseau de soins" onPress={() => navigation.navigate("ReseauSoins")} />
          <ListRow icon="time-outline" label="Historique de soins" onPress={() => navigation.navigate("Historique")} />
          <ListRow icon="people-outline" label="Ma famille" onPress={() => navigation.navigate("Famille")} />
          {estAssurePrincipal ? (
            <ListRow icon="key-outline" label="Accès famille" onPress={() => navigation.navigate("Delegations")} />
          ) : null}
        </View>
      </Card>

      <Card style={{ padding: 0, marginTop: 4 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow icon="chatbubbles-outline" label="Messagerie" onPress={() => navigation.navigate("MessagerieListe")} />
          <ListRow icon="person-circle-outline" label="Mon profil" onPress={() => navigation.navigate("MonProfil")} />
          <ListRow icon="log-out-outline" label="Déconnexion" iconColor="#dc2626" onPress={() => logout()} />
        </View>
      </Card>
    </Screen>
  );
}
