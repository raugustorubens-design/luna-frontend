export function ChatTerminal() {
  return (
    <section className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-semibold">LUNA Conversational Core</h3>
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-luna-cyan/30 bg-luna-secondary/60 p-3">Thinking... consolidando memória episódica em blocos semânticos.</div>
        <div className="rounded-xl border border-luna-violet/30 bg-luna-secondary/40 p-3">Reflection: conflito detectado no self-model, aplicando reforço contextual.</div>
        <div className="rounded-xl border border-luna-success/30 bg-luna-secondary/40 p-3">Estado estabilizado. Continuidade mental preservada.</div>
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-luna-textMuted">▶ stream ativo · 17 tokens/s</div>
    </section>
  );
}
