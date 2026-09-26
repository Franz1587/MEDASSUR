import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getConversations, type Conversation } from "@/services/messagerie.service";
import { jouerSonNotification } from "@/lib/sonNotification";
import { runSilently } from "@/lib/http";

// Bulles + son de notification pour la messagerie (2026-09) — voir demande
// utilisateur : "il faut que l'application fasse apparaître des bulles de
// message entrant... aussi longtemps qu'un message ou une conversation ne
// sera pas prise par un agent humain... toutes les 5 minutes elles doivent
// se comporter comme des nouveaux messages afin d'importuner les
// gestionnaires, l'administrateur, bref tout ce qui gère les contrats et la
// saisie des factures des prestataires, demande de prise en charge,
// remboursement." Un seul hook, utilisé par AdminShell.tsx (interne) ET
// PortalShell.tsx (externe) — même source de vérité que le badge non-lus
// déjà en place (getConversations, déjà cloisonné par rôle côté serveur,
// voir MessagerieService.liste).
//
// Correctif (2026-09) — la première version gardait UNE SEULE horloge
// globale ("dernierRappel") pour toute la file non prise, réinitialisée à 0
// dès que la file passait à zéro dossier, même temporairement (tri/latence
// réseau) : elle "consommait" alors sa relance sans que 5 minutes se soient
// réellement écoulées, et donnait l'impression de ne plus jamais se
// redéclencher. Remplacée par UNE HORLOGE PAR CONVERSATION
// (dernièreAlerte.get(id)) — chaque dossier non pris se relance exactement
// 5 minutes après SA dernière alerte, qu'il s'agisse d'un vrai nouveau
// message ou d'une relance : littéralement le même chemin de code (même
// bulle, même son) dans les deux cas, comme demandé.
const POLL_MS = 20_000;
const RAPPEL_NON_PRISE_MS = 5 * 60 * 1000;

interface OptionsAlertesMessagerie {
  // Seuls les rôles internes peuvent "prendre" une conversation (voir
  // prendreConversation) — le rappel insistant "non prise" n'a de sens que
  // pour eux ; un compte externe reçoit uniquement l'alerte "nouveau
  // message" ci-dessous, une fois par message.
  interne: boolean;
  // Suspend l'alerte "nouveau message tout juste arrivé" quand l'utilisateur
  // est déjà sur l'écran Messagerie — il le voit directement. Ne suspend
  // JAMAIS la relance "non pris depuis 5 min" : être sur l'écran Messagerie
  // ne veut pas dire que CE dossier précis a été pris en charge.
  suspendreNouveauMessage?: boolean;
  onOuvrir?: (conversationId?: string) => void;
}

function notifier(titre: string, description: string, onOuvrir: (() => void) | undefined, avertissement: boolean): void {
  const options = { description, duration: avertissement ? 12000 : 9000, action: { label: "Ouvrir", onClick: () => onOuvrir?.() } };
  if (avertissement) toast.warning(titre, options);
  else toast(titre, options);
  jouerSonNotification();
}

export function useAlertesMessagerie({ interne, suspendreNouveauMessage, onOuvrir }: OptionsAlertesMessagerie): void {
  const dernierUpdatedAt = useRef<Map<string, string>>(new Map());
  const derniereAlerte = useRef<Map<string, number>>(new Map());
  const premierChargement = useRef(true);
  const onOuvrirRef = useRef(onOuvrir);
  onOuvrirRef.current = onOuvrir;
  const suspendreRef = useRef(suspendreNouveauMessage);
  suspendreRef.current = suspendreNouveauMessage;

  useEffect(() => {
    let annule = false;
    let enCours = false;

    const verifier = async () => {
      // Une vérification à la fois — un onglet resté en arrière-plan peut
      // accumuler plusieurs déclenchements (setInterval + reprise de
      // visibilité) qui se chevauchent une fois l'onglet réactivé.
      if (enCours) return;
      enCours = true;
      let conversations: Conversation[];
      try {
        // Veille de fond — jamais l'overlay de chargement plein écran
        // (PageLoader), même logique que useAlertesDossiers.ts.
        conversations = await runSilently(() => getConversations());
      } catch {
        enCours = false;
        return; // silencieux — le badge non-lus existant gère déjà l'affichage d'erreur réseau
      }
      enCours = false;
      if (annule) return;

      const maintenant = Date.now();
      for (const c of conversations) {
        const vuAt = dernierUpdatedAt.current.get(c.id);
        const estNouveauMessage = !premierChargement.current && !!vuAt && vuAt !== c.updatedAt;
        dernierUpdatedAt.current.set(c.id, c.updatedAt);

        const estEnAttente = interne && !c.assigneAId && (c.statut === "Ouverte" || c.statut === "EnCoursHumain");
        const derniereFois = derniereAlerte.current.get(c.id) ?? 0;
        const relanceDue = estEnAttente && maintenant - derniereFois >= RAPPEL_NON_PRISE_MS;

        if (!estEnAttente) derniereAlerte.current.delete(c.id); // pris en charge / résolu — la relance repart de zéro si ça redevient un jour "en attente"

        if (estNouveauMessage && !suspendreRef.current) {
          notifier(`Nouveau message — ${c.objet}`, "Cliquez pour ouvrir la conversation.", () => onOuvrirRef.current?.(c.id), false);
          derniereAlerte.current.set(c.id, maintenant);
        } else if (relanceDue) {
          notifier(`Conversation en attente — ${c.objet}`, "Aucun agent ne l'a encore prise en charge. Cliquez pour l'ouvrir.", () => onOuvrirRef.current?.(c.id), true);
          derniereAlerte.current.set(c.id, maintenant);
        } else if (estNouveauMessage) {
          // Alerte "nouveau message" suspendue (déjà sur l'écran Messagerie) —
          // on marque quand même l'horodatage pour ne pas la faire ressurgir
          // artificiellement dès qu'on quittera cet écran.
          derniereAlerte.current.set(c.id, maintenant);
        }
      }
      premierChargement.current = false;
    };

    verifier();
    const id = setInterval(verifier, POLL_MS);
    // Rattrapage à la reprise de visibilité (2026-09) — un onglet mis en
    // arrière-plan voit ses setInterval fortement throttlés par le
    // navigateur (jusqu'à une fois par minute, voire suspendus) : sans ce
    // correctif, la relance à 5 minutes pouvait sembler "ne plus jamais se
    // redéclencher" tant que l'onglet MedAssur restait en arrière-plan.
    const surVisibilite = () => { if (document.visibilityState === "visible") verifier(); };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("focus", surVisibilite);
    return () => {
      annule = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("focus", surVisibilite);
    };
    // onOuvrir/suspendreNouveauMessage lus via ref (onOuvrirRef/suspendreRef)
    // pour ne jamais réinitialiser l'intervalle — sinon chaque changement de
    // vue relancerait le polling et perdrait dernierUpdatedAt/derniereAlerte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interne]);
}
