const metrics = [
  ["Retrieval score", "0.93", "#22D3EE"],
  ["Salience", "0.78", "#F59E0B"],
  ["Reinforcement", "124", "#8B5CF6"],
  ["Active memories", "2,431", "#10B981"],
  ["Runtime cognition", "Stable", "#10B981"],
  ["State recovery", "97%", "#22D3EE"],
  ["Provider routing", "Adaptive", "#A78BFA"],
  ["Telemetry", "Live", "#EF4444"]
];

export function ObservabilityPanel() {
  return (
    <section className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-semibold">Observabilidade Cognitiva</h3>
      <div className="space-y-2">
        {metrics.map(([name, value, color]) => (
          <div key={name as string} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
            <span className="text-luna-textSub">{name as string}</span>
            <span style={{ color: color as string }}>{value as string}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
