import { useEffect, useRef, useState } from "react";
import {
  Brain, Send, User, Sparkles, FileSearch, AlertTriangle, MessageSquare,
  BarChart3, Shield, Activity, FileText, TrendingUp, Award,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getIaWelcomeMessage, getIaSuggestions, chatAssistant, chatAriana } from "@/services/ai.service";

type ChatMessage = { role: "assistant" | "user"; content: string };

const capacitesCis = [
  { icon: FileSearch, text: "Analyse contrats & polices" },
  { icon: AlertTriangle, text: "Détection fraudes & anomalies" },
  { icon: MessageSquare, text: "Génération de courriers" },
  { icon: BarChart3, text: "Rapports automatisés" },
  { icon: Shield, text: "Audit conformité CIMA" },
  { icon: Activity, text: "Scoring risques clients" },
];

const capacitesAriana = [
  { icon: FileText, text: "Lecture des propositions compagnies" },
  { icon: TrendingUp, text: "Comparaison des cotations" },
  { icon: Award, text: "Recommandation de la meilleure offre" },
  { icon: BarChart3, text: "Analyse tableaux de garanties" },
  { icon: Shield, text: "Vérification conformité CIMA" },
];

const ARIANA_WELCOME = "Bonjour ! Je suis ARIANA, l'assistante spécialisée en appels d'offres santé de MEDASSUR+. Je peux comparer les propositions des compagnies, analyser les tableaux de garanties, expliquer les cotations et vous aider à choisir la meilleure offre pour vos assurés. Comment puis-je vous aider ?";

const ARIANA_SUGGESTIONS = [
  "Comparer les garanties hospitalisation de deux compagnies",
  "Expliquer la différence entre taux assuré et taux ayants droit",
  "Analyser une cotation pour un groupe de 50 personnes",
  "Quels critères retenir pour choisir une compagnie ?",
];

function ChatPanel({ messages, input, onInput, onSend, placeholder, avatar }: {
  messages: ChatMessage[];
  input: string;
  onInput: (v: string) => void;
  onSend: (text?: string) => void;
  placeholder: string;
  avatar: React.ReactNode;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <div className="lg:col-span-3 bg-card border border-border rounded-xl flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                {avatar}
              </div>
            )}
            <div className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-foreground"}`}>
              {m.content.split("\n").map((line, j) => (
                <p key={j} className={line.startsWith("**") ? "font-semibold mb-1 mt-1" : ""}>{line.replace(/\*\*/g, "")}</p>
              ))}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-2.5 bg-secondary/40 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            placeholder={placeholder}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSend()}
          />
          <button onClick={() => onSend()} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IAView() {
  const [activeTab, setActiveTab] = useState<"cis" | "ariana">("cis");

  const [cisMessages, setCisMessages] = useState<ChatMessage[]>([]);
  const [cisSuggestions, setCisSuggestions] = useState<string[]>([]);
  const [cisInput, setCisInput] = useState("");

  const [arianaMessages, setArianaMessages] = useState<ChatMessage[]>([{ role: "assistant", content: ARIANA_WELCOME }]);
  const [arianaInput, setArianaInput] = useState("");

  useEffect(() => {
    setCisMessages([{ role: "assistant", content: getIaWelcomeMessage() }]);
    setCisSuggestions(getIaSuggestions());
  }, []);

  const handleCisSend = (text?: string) => {
    const msg = text || cisInput;
    if (!msg.trim()) return;
    const next: ChatMessage[] = [...cisMessages, { role: "user", content: msg }];
    setCisMessages(next);
    setCisInput("");
    chatAssistant(msg, cisMessages).then((reply) => {
      setCisMessages([...next, { role: "assistant", content: reply }]);
    }).catch(() => {
      setCisMessages([...next, { role: "assistant", content: "Désolé, une erreur est survenue. Réessayez dans un instant." }]);
    });
  };

  const handleArianaSend = (text?: string) => {
    const msg = text || arianaInput;
    if (!msg.trim()) return;
    const next: ChatMessage[] = [...arianaMessages, { role: "user", content: msg }];
    setArianaMessages(next);
    setArianaInput("");
    chatAriana(msg, arianaMessages).then((reply) => {
      setArianaMessages([...next, { role: "assistant", content: reply }]);
    }).catch(() => {
      setArianaMessages([...next, { role: "assistant", content: "ARIANA est indisponible pour le moment. Réessayez dans un instant." }]);
    });
  };

  return (
    <div className="p-6 h-full flex flex-col" style={{ minHeight: 0 }}>
      <ModuleHeader title="Intelligence Artificielle" subtitle="CIS IA · ARIANA — Assistance métier et appels d'offres santé" icon={Brain} />

      <div className="flex items-center gap-1 mb-4 bg-secondary/30 rounded-lg p-1 w-fit">
        <button type="button" onClick={() => setActiveTab("cis")} className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 ${activeTab === "cis" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Brain className="w-3.5 h-3.5" />CIS IA
        </button>
        <button type="button" onClick={() => setActiveTab("ariana")} className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium flex items-center gap-1.5 ${activeTab === "ariana" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Sparkles className="w-3.5 h-3.5" />ARIANA
        </button>
      </div>

      {activeTab === "cis" ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 0 }}>
          <ChatPanel
            messages={cisMessages} input={cisInput} onInput={setCisInput} onSend={handleCisSend}
            placeholder="Posez votre question ou demandez une analyse…"
            avatar={<Brain className="w-4 h-4 text-primary" />}
          />
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Suggestions rapides</h3>
              </div>
              <div className="space-y-1.5">
                {cisSuggestions.map((s) => (
                  <button key={s} onClick={() => handleCisSend(s)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Capacités IA</h3>
              <div className="space-y-2">
                {capacitesCis.map(({ icon: I, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <I className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 0 }}>
          <ChatPanel
            messages={arianaMessages} input={arianaInput} onInput={setArianaInput} onSend={handleArianaSend}
            placeholder="Demandez à ARIANA de comparer des offres, analyser une cotation…"
            avatar={<Sparkles className="w-4 h-4 text-primary" />}
          />
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Suggestions ARIANA</h3>
              </div>
              <div className="space-y-1.5">
                {ARIANA_SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => handleArianaSend(s)}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                  >{s}</button>
                ))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Capacités ARIANA</h3>
              <div className="space-y-2">
                {capacitesAriana.map(({ icon: I, text }) => (
                  <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <I className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
