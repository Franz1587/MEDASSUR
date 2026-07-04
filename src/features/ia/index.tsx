import { useEffect, useState } from "react";
import {
  Brain, Send, User, Sparkles, FileSearch, AlertTriangle, MessageSquare,
  BarChart3, Shield, Activity,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { getIaWelcomeMessage, getIaSuggestions, chatAssistant } from "@/services/ai.service";

type ChatMessage = { role: "assistant" | "user"; content: string };

const capacites = [
  { icon: FileSearch, text: "Analyse contrats & polices" },
  { icon: AlertTriangle, text: "Détection fraudes & anomalies" },
  { icon: MessageSquare, text: "Génération de courriers" },
  { icon: BarChart3, text: "Rapports automatisés" },
  { icon: Shield, text: "Audit conformité CIMA" },
  { icon: Activity, text: "Scoring risques clients" },
];

export default function IAView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    setMessages([{ role: "assistant", content: getIaWelcomeMessage() }]);
    setSuggestions(getIaSuggestions());
  }, []);

  const handleSend = (text?: string) => {
    const msg = text || input;
    if (!msg.trim()) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: msg }];
    setMessages(next);
    setInput("");
    chatAssistant(msg).then((reply) => {
      setMessages([...next, { role: "assistant", content: reply }]);
    });
  };

  return (
    <div className="p-6 h-full flex flex-col" style={{ minHeight: 0 }}>
      <ModuleHeader title="CourtEVA+IA — Assistant Intelligent" subtitle="Analyse de contrats · Détection de fraudes · Génération de documents · Assistance métier" icon={Brain} />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ minHeight: 0 }}>
        <div className="lg:col-span-3 bg-card border border-border rounded-xl flex flex-col" style={{ height: "calc(100vh - 300px)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Brain className="w-4 h-4 text-primary" />
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
          </div>
          <div className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                className="flex-1 px-4 py-2.5 bg-secondary/40 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Posez votre question ou demandez une analyse…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button onClick={() => handleSend()} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Suggestions rapides</h3>
            </div>
            <div className="space-y-1.5">
              {suggestions.map((s) => (
                <button key={s} onClick={() => handleSend(s)}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Capacités IA</h3>
            <div className="space-y-2">
              {capacites.map(({ icon: I, text }) => (
                <div key={text} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <I className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
