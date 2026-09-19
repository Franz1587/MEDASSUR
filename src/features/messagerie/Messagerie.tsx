import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Paperclip, UserPlus, Bot, User, Headset, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
import { Badge, type BadgeVariant } from "@/components/shared/Badge";
import {
  getConversations, getMessages, creerConversation, envoyerMessage, prendreConversation,
  marquerConversationLue, urlPieceJointeMessagerie, type Conversation, type Message,
} from "@/services/messagerie.service";
import arianaAvatar from "@/assets/ariana-avatar.png";

// Messagerie universelle (2026-08) — voir demande utilisateur : "il faut
// créer pour tous les acteurs ou utilisateur un onglet de Messagerie
// permettant, aux assurés, au client et aux prestataire de discuter
// directement avec l'assurance depuis l'application... chaque agent doit
// avoir un onglet messagerie qui fonctionne en temps réel et qui
// s'actualise toutes les 15s avec une bulle d'indication de nouveau
// message." UN seul composant pour tous les shells (interne comme
// externe) — adapte son comportement via currentRole.family, exactement
// comme MessagerieService.estRoleInterne côté backend.
const MESSAGERIE_POLL_MS = 15_000;

// Confidentialité de l'identité de l'agent (2026-08) — voir demande
// utilisateur : "je ne veux pas que l'application révèle directement que
// l'utilisateur externe parle avec un agent IA". Tout ce qui suit
// (labels, icônes, statuts) est donc VOLONTAIREMENT neutre côté externe —
// aucune mention "IA"/"EnCoursIA" ne doit jamais atteindre son écran,
// même indirectement via un badge de statut. Côté interne, la distinction
// réelle reste affichée (utile pour la supervision des agents).
const STATUT_VARIANT: Record<string, BadgeVariant> = {
  Ouverte: "warning", EnCoursIA: "info", EnCoursHumain: "info", Resolue: "success", Fermee: "neutral",
};
const STATUT_LABEL_INTERNE: Record<string, string> = {
  Ouverte: "Ouverte", EnCoursIA: "En cours (auto)", EnCoursHumain: "En cours (agent)", Resolue: "Résolue", Fermee: "Fermée",
};
const STATUT_LABEL_EXTERNE: Record<string, string> = {
  Ouverte: "Ouverte", EnCoursIA: "En cours", EnCoursHumain: "En cours", Resolue: "Résolue", Fermee: "Fermée",
};
function statutLabel(statut: string, interne: boolean): string {
  return (interne ? STATUT_LABEL_INTERNE : STATUT_LABEL_EXTERNE)[statut] ?? statut;
}

// Ariana comme identité UNIQUE et continue côté externe (2026-08) — voir
// demande utilisateur : "il faut appeler l'agent IA 'ARIANA'... je suis
// Ariana votre Conseiller Clients". Puisque le message d'ouverture de
// l'agent se présente lui-même ainsi dans le texte, le nom affiché
// au-dessus de la bulle doit rester cohérent avec ce texte — et reste
// "Ariana" même si la conversation est ensuite reprise par un vrai
// conseiller (auteurType "Agent"), pour ne jamais laisser transparaître la
// bascule (voir demande utilisateur précédente : "sans que l'interlocuteur
// externe ne s'en rende compte"). Côté interne, la distinction réelle
// reste affichée (utile pour la supervision des agents).
function auteurLabel(m: Message, interne: boolean): string {
  if (!interne) return "Ariana";
  if (m.auteurType === "IA") return "Ariana";
  if (m.auteurType === "Agent") return "Agent MedAssur";
  return "Vous";
}

function AuteurAvatar({ type, interne }: { type: string; interne: boolean }) {
  // Photo d'Ariana pour tout message IA, et pour TOUT message côté externe
  // (même repris par un conseiller — voir auteurLabel ci-dessus).
  if (type === "IA" || !interne) return <img src={arianaAvatar} alt="Ariana" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />;
  if (type === "Agent") return <Headset className="w-3.5 h-3.5" />;
  return <User className="w-3.5 h-3.5" />;
}

// Pas de choix de canal côté externe (2026-08) — voir demande utilisateur :
// "ce n'est pas nécessaire, pas besoin de signaler ou de sélectionner.
// Toute question posée doit directement être gérée par l'agent IA.
// Maintenant si c'est du domaine de sa limite de droit, il bascule le
// sujet vers l'agent Humain sans que l'interlocuteur externe ne s'en
// rende compte." Toute conversation externe démarre donc sur canal "IA" —
// la bascule vers un conseiller se fait ensuite silencieusement (voir
// MessagerieAgentIaService.escalader), jamais par un choix affiché ici.
// Un agent interne qui ouvre lui-même une conversation voit ce canal
// forcé à "Humain" côté serveur de toute façon (voir MessagerieService.
// creer, estRoleInterne) — la valeur envoyée ici n'a donc d'effet que
// pour un demandeur externe.
function NouvelleConversationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Conversation) => void }) {
  const [objet, setObjet] = useState("");
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!objet.trim() || !message.trim()) { toast.error("Objet et message sont obligatoires."); return; }
    setEnvoi(true);
    try {
      const conversation = await creerConversation(objet.trim(), "IA", message.trim());
      toast.success("Conversation ouverte.");
      onCreated(conversation);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-5 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-foreground">Nouvelle conversation</h3>
          <button type="button" onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-md"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="text-[11.5px] text-muted-foreground mb-1 block">Objet</label>
          <input
            value={objet} onChange={(e) => setObjet(e.target.value)}
            placeholder="Ex. Question sur ma prise en charge"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-[12.5px] text-foreground"
          />
        </div>

        <div>
          <label className="text-[11.5px] text-muted-foreground mb-1 block">Message</label>
          <textarea
            value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
            placeholder="Décrivez votre demande…"
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-[12.5px] text-foreground resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-9 px-3.5 rounded-lg border border-border text-[12.5px] text-foreground hover:bg-secondary/40">Annuler</button>
          <button type="button" onClick={envoyer} disabled={envoi} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium disabled:opacity-60">
            {envoi ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessagerieView() {
  const { currentUser, currentRole } = useAuth();
  const interne = currentRole?.family === "interne";
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [modalOuvert, setModalOuvert] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  // Champ de saisie qui s'agrandit avec le texte (2026-09) — voir demande
  // utilisateur : "on ne parvient pas à lire tout le message avant de
  // l'envoyer, ce qui rend difficile la correction des fautes". L'ancien
  // champ restait figé à 1 ligne (rows=1) : un message un peu long
  // défilait invisiblement à l'intérieur d'une case minuscule, surtout sur
  // mobile où le clavier virtuel mange déjà la moitié de l'écran — la
  // relecture avant envoi était donc impossible. Recalcul manuel de la
  // hauteur (plutôt que la propriété CSS field-sizing:content utilisée par
  // le Textarea générique de l'app, encore mal supportée sur Safari) pour
  // un comportement fiable sur tous les navigateurs mobiles.
  const texteRef = useRef<HTMLTextAreaElement>(null);
  const MESSAGE_HAUTEUR_MAX_PX = 160;
  useEffect(() => {
    const el = texteRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MESSAGE_HAUTEUR_MAX_PX)}px`;
  }, [texte]);

  const rafraichirListe = () => getConversations().then(setConversations).catch(() => undefined);

  useEffect(() => {
    rafraichirListe();
    const id = setInterval(rafraichirListe, MESSAGERIE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selectedId) { setMessages(null); return; }
    const rafraichir = () => getMessages(selectedId).then(setMessages).catch(() => undefined);
    rafraichir();
    marquerConversationLue(selectedId).then(rafraichirListe).catch(() => undefined);
    const id = setInterval(() => { rafraichir(); marquerConversationLue(selectedId).catch(() => undefined); }, MESSAGERIE_POLL_MS);
    return () => clearInterval(id);
  }, [selectedId]);

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectionner = (id: string) => setSelectedId(id);

  const prendre = async (id: string) => {
    try {
      await prendreConversation(id);
      toast.success("Conversation prise en charge.");
      rafraichirListe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prise en charge impossible.");
    }
  };

  const envoyer = async () => {
    if (!selectedId || (!texte.trim() && !fichier)) return;
    setEnvoi(true);
    try {
      await envoyerMessage(selectedId, texte.trim(), fichier ?? undefined);
      setTexte("");
      setFichier(null);
      if (fichierRef.current) fichierRef.current.value = "";
      const frais = await getMessages(selectedId);
      setMessages(frais);
      rafraichirListe();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const conversation = conversations?.find((c) => c.id === selectedId) ?? null;
  const file = interne ? (conversations ?? []).filter((c) => c.assigneAId === null) : [];
  const mesConversations = interne ? (conversations ?? []).filter((c) => c.assigneAId !== null) : (conversations ?? []);

  const ligneConversation = (c: Conversation) => (
    <button
      key={c.id} type="button" onClick={() => selectionner(c.id)}
      className={`w-full text-left px-3.5 py-3 rounded-xl border transition-colors ${selectedId === c.id ? "bg-primary/10 border-primary/40" : "border-border hover:bg-secondary/40"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-foreground truncate">{c.objet}</p>
        <Badge variant={STATUT_VARIANT[c.statut] ?? "neutral"}>{statutLabel(c.statut, interne)}</Badge>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-muted-foreground">{new Date(c.updatedAt).toLocaleString("fr-FR")}</span>
        {interne && <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">{c.canal === "IA" ? <Bot className="w-3 h-3" /> : <Headset className="w-3 h-3" />}{c.canal}</span>}
      </div>
      {interne && c.assigneAId === null && (
        <button
          type="button" onClick={(e) => { e.stopPropagation(); prendre(c.id); }}
          className="mt-2 h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium inline-flex items-center gap-1"
        >
          <UserPlus className="w-3 h-3" />Prendre
        </button>
      )}
    </button>
  );

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[1.2rem] font-bold text-foreground flex items-center gap-2"><MessageCircle className="w-5 h-5 text-primary" />Messagerie</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {interne ? "Échanges avec les assurés, clients et prestataires." : "Échangez directement avec MedAssur."}
          </p>
        </div>
        {!interne && (
          <button type="button" onClick={() => setModalOuvert(true)} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-medium inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />Nouvelle conversation
          </button>
        )}
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-0">
        <div className="bg-card border border-border rounded-2xl p-3 overflow-y-auto space-y-4">
          {!conversations ? (
            <div className="text-center text-muted-foreground text-[12.5px] py-8">Chargement…</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground text-[12.5px] py-8">Aucune conversation pour l'instant.</div>
          ) : interne ? (
            <>
              {file.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground px-1">File d'attente ({file.length})</p>
                  {file.map(ligneConversation)}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground px-1">Mes conversations ({mesConversations.length})</p>
                {mesConversations.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground px-1">Aucune conversation prise en charge.</p>
                ) : mesConversations.map(ligneConversation)}
              </div>
            </>
          ) : (
            <div className="space-y-2">{mesConversations.map(ligneConversation)}</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl flex flex-col min-h-0">
          {!conversation ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-[12.5px]">Sélectionnez une conversation.</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  {!interne && <img src={arianaAvatar} alt="Ariana" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />}
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{conversation.objet}</p>
                    <p className="text-[11px] text-muted-foreground">Ouverte le {new Date(conversation.createdAt).toLocaleString("fr-FR")}</p>
                  </div>
                </div>
                <Badge variant={STATUT_VARIANT[conversation.statut] ?? "neutral"}>{statutLabel(conversation.statut, interne)}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {!messages ? (
                  <p className="text-center text-muted-foreground text-[12px]">Chargement…</p>
                ) : messages.map((m) => {
                  const moi = m.auteurId === currentUser?.id;
                  return (
                    <div key={m.id} className={`flex ${moi ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 ${moi ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-foreground"}`}>
                        {!moi && (
                          <p className="text-[10.5px] font-semibold mb-0.5 inline-flex items-center gap-1 opacity-80"><AuteurAvatar type={m.auteurType} interne={interne} />{auteurLabel(m, interne)}</p>
                        )}
                        {m.contenu && <p className="text-[12.5px] whitespace-pre-wrap break-words">{m.contenu}</p>}
                        {m.pieceJointe && (
                          <a href={urlPieceJointeMessagerie(m.pieceJointe)} target="_blank" rel="noreferrer" className={`text-[11.5px] underline inline-flex items-center gap-1 mt-1 ${moi ? "text-primary-foreground/90" : "text-primary"}`}>
                            <Paperclip className="w-3 h-3" />Pièce jointe
                          </a>
                        )}
                        <p className={`text-[10px] mt-1 ${moi ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(m.dateEnvoi).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={finRef} />
              </div>

              <div className="px-4 py-3 border-t border-border flex-shrink-0 space-y-2">
                {fichier && (
                  <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <Paperclip className="w-3.5 h-3.5" />{fichier.name}
                    <button type="button" onClick={() => { setFichier(null); if (fichierRef.current) fichierRef.current.value = ""; }} className="text-destructive hover:underline">Retirer</button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={fichierRef} type="file" className="hidden" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
                  <button type="button" onClick={() => fichierRef.current?.click()} className="h-9 w-9 flex-shrink-0 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 flex items-center justify-center">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <textarea
                    ref={texteRef}
                    value={texte} onChange={(e) => setTexte(e.target.value)} rows={1}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                    placeholder="Votre message…"
                    spellCheck autoCorrect="on" autoCapitalize="sentences"
                    style={{ maxHeight: MESSAGE_HAUTEUR_MAX_PX }}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-[12.5px] text-foreground resize-none overflow-y-auto leading-relaxed"
                  />
                  <button
                    type="button" onClick={envoyer} disabled={envoi || (!texte.trim() && !fichier)}
                    className="h-9 w-9 flex-shrink-0 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modalOuvert && (
        <NouvelleConversationModal
          onClose={() => setModalOuvert(false)}
          onCreated={(c) => { setModalOuvert(false); rafraichirListe(); setSelectedId(c.id); }}
        />
      )}
    </div>
  );
}
