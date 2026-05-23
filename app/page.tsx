import { Activity, Brain, Cpu, Orbit, Sparkles } from "lucide-react";
import { Hero } from "@/components/hero";
import { CognitiveDashboard } from "@/components/cognitive-dashboard";
import { PipelineView } from "@/components/pipeline-view";
import { ChatTerminal } from "@/components/chat-terminal";
import { ObservabilityPanel } from "@/components/observability-panel";

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40">
        <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-luna-violet blur-[120px]" />
        <div className="absolute right-10 top-1/3 h-80 w-80 rounded-full bg-luna-cyan blur-[120px]" />
      </div>

      <Hero />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-4">
        {[
          ["Episodic Memory", "Continuity threads stable", Brain, "#10B981"],
          ["Semantic Core", "Concept graph converging", Orbit, "#22D3EE"],
          ["Reflection Layer", "Recursive reasoning active", Sparkles, "#A78BFA"],
          ["Runtime Cognition", "Provider routing synchronized", Cpu, "#F59E0B"]
        ].map(([title, subtitle, Icon, accent]) => (
          <article key={title as string} className="glass rounded-2xl p-5">
            <Icon className="mb-3" style={{ color: accent as string }} />
            <h3 className="text-sm font-semibold">{title as string}</h3>
            <p className="mt-2 text-xs text-luna-textMuted">{subtitle as string}</p>
          </article>
        ))}
      </section>

      <CognitiveDashboard />
      <PipelineView />

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-20 lg:grid-cols-5">
        <div className="lg:col-span-3"><ChatTerminal /></div>
        <div className="lg:col-span-2"><ObservabilityPanel /></div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-luna-textMuted">
        <Activity className="mx-auto mb-2" size={14} />
        LUNA — Persistent Cognitive Entity Interface
      </footer>
    </main>
  );
}
