import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

// Hauteur réelle du clavier (2026-09) — voir demande utilisateur : "quand
// le clavier s'affiche, on ne peut plus voir ce qu'on saisit, la zone est
// masquée par le clavier" — constaté sur l'écran de connexion, la
// messagerie (conversation existante ET nouvelle conversation). Constaté :
// KeyboardAvoidingView seul (behavior="height"/"padding") ne suffit plus de
// façon fiable sur les appareils récents en mode edge-to-edge — le clavier
// peut recouvrir un champ sans que la vue ne remonte du tout. Cette valeur,
// appliquée en paddingBottom/marginBottom sur la zone concernée, pousse le
// contenu au-dessus du clavier de façon déterministe, indépendamment du
// comportement système.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const subShow = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const subHide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => { subShow.remove(); subHide.remove(); };
  }, []);
  return height;
}
