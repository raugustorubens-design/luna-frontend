const nodes = ["Memory", "Consolidation", "Reflection", "Self-model", "Attention", "Associative", "L-cells"];

export function PipelineView() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <h2 className="mb-4 text-xl font-semibold">Neural Pipeline</h2>
      <div className="glass rounded-2xl p-6">
        <div className="grid gap-4 md:grid-cols-7">
          {nodes.map((n, i) => (
            <div key={n} className="relative rounded-xl border border-white/10 bg-luna-panel/60 p-3 text-center text-xs">
              {n}
              {i < nodes.length - 1 && <div className="absolute -right-3 top-1/2 hidden h-px w-6 bg-gradient-to-r from-luna-violet to-luna-cyan md:block" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
