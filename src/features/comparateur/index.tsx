import { useState } from "react";
import {
  ScanLine, ChevronRight, Upload, FileSearch, Brain, BarChart3,
  CheckCircle, Download, RefreshCw,
} from "lucide-react";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Btn } from "@/components/shared/Btn";
import { fmtM } from "@/lib/format";
import { compareOffers } from "@/services/ai.service";
import type { Offre } from "@/types/comparateur";

export default function ComparateurView() {
  const [step, setStep] = useState<"upload" | "processing" | "result">("upload");
  const [dragging, setDragging] = useState(false);
  const [offres, setOffres] = useState<Offre[]>([]);
  const [synthese, setSynthese] = useState("");

  const runAnalysis = () => {
    setStep("processing");
    compareOffers().then(({ offres, synthese }) => {
      setOffres(offres);
      setSynthese(synthese);
      setStep("result");
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    runAnalysis();
  };

  return (
    <div className="p-6">
      <ModuleHeader title="Comparateur IA — OCR" subtitle="Import et analyse automatique des offres d'assurance multi-compagnies" icon={ScanLine} />

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: "upload", label: "1. Importer les offres" },
          { key: "processing", label: "2. Analyse OCR + IA" },
          { key: "result", label: "3. Comparatif généré" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setStep(s.key as typeof step)}
              className={`px-4 py-2 rounded-lg text-sm transition-colors font-medium ${step === s.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"}`}
            >
              {s.label}
            </button>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground/40" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/3"}`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-semibold mb-1">Glissez vos offres ici</p>
                <p className="text-sm text-muted-foreground">Formats: PDF, Word, Excel, images scannées · Max 50 Mo</p>
              </div>
              <button
                onClick={runAnalysis}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-1"
              >
                Parcourir les fichiers
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { icon: FileSearch, title: "OCR Intelligent", desc: "Extraction automatique des garanties, franchises, capitaux et primes depuis tout format de document." },
              { icon: Brain, title: "Analyse IA", desc: "Détection d'incohérences, exclusions cachées et clauses défavorables au client." },
              { icon: BarChart3, title: "Comparatif Auto", desc: "Génération d'un tableau comparatif clair et d'une proposition personnalisée orientant le choix." },
            ].map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-4 hover:border-primary/20 transition-colors">
                <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3"><f.icon className="w-4 h-4 text-primary" /></div>
                <h4 className="font-semibold text-foreground text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-24 space-y-5">
          <div className="relative w-16 h-16">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Brain className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-foreground font-semibold">Analyse en cours…</p>
            <p className="text-sm text-muted-foreground">Extraction OCR · Vectorisation · Comparaison · Scoring IA</p>
          </div>
          <div className="flex gap-2">
            {["ACTIVA_offre.pdf", "AXA_conditions.docx", "Allianz_scan.jpg"].map((f) => (
              <span key={f} className="text-xs px-3 py-1.5 bg-card border border-border rounded-lg text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-foreground font-medium">{offres.length} offres analysées</span>
              <span className="text-muted-foreground">· Flotte Auto 15 véhicules · SABC SA · Yaoundé</span>
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary"><Download className="w-4 h-4" />Exporter PDF</Btn>
              <Btn variant="ghost" onClick={() => setStep("upload")}><RefreshCw className="w-4 h-4" />Nouvelle analyse</Btn>
            </div>
          </div>

          {/* AI insight */}
          <div className="bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/15 rounded-lg flex-shrink-0 mt-0.5"><Brain className="w-4 h-4 text-primary" /></div>
              <div>
                <p className="text-sm font-semibold text-foreground">Analyse IA — Synthèse comparative</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{synthese}</p>
              </div>
            </div>
          </div>

          {/* Offer cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {offres.map((o) => (
              <div key={o.compagnie} className={`bg-card rounded-xl p-5 relative border ${o.recommande ? "border-primary shadow-lg shadow-primary/5" : "border-border"}`}>
                {o.recommande && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full whitespace-nowrap">
                    ★ Recommandé
                  </div>
                )}
                <div className="text-center mb-4 pt-1">
                  <h3 className="font-bold text-foreground text-sm">{o.compagnie}</h3>
                  <div className="text-2xl font-bold text-primary mt-2" style={{ fontFamily: "'DM Mono', monospace" }}>{fmtM(o.prime)}</div>
                  <p className="text-xs text-muted-foreground">XAF / an</p>
                </div>
                <div className="space-y-1.5 mb-4">
                  {o.garanties.map((g) => (
                    <div key={g} className="flex items-center gap-2 text-xs">
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-muted-foreground">{g}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Franchise</span>
                    <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{o.franchise}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plafond</span>
                    <span className="text-foreground font-semibold" style={{ fontFamily: "'DM Mono', monospace" }}>{o.plafond}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted-foreground">Score IA</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-secondary rounded-full h-1.5">
                        <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${o.score}%` }} />
                      </div>
                      <span className="font-bold text-primary text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>{o.score}/100</span>
                    </div>
                  </div>
                </div>
                <button className={`w-full mt-4 py-2.5 text-xs rounded-lg font-semibold transition-all ${o.recommande ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-secondary text-foreground hover:bg-secondary/80"}`}>
                  Sélectionner cette offre
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
