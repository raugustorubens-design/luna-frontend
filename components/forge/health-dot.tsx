/**
 * ADR-022, Forge v2 — átomo visual compartilhado por `command-bar.tsx` e
 * `status-bar.tsx`.
 *
 * `"none"` é um estado de primeira classe, não um caso esquecido: é o que os
 * dois usam sempre que não há endpoint de saúde por trás do indicador
 * (armadilha 3 do pacote — "sem leitura" cinza, nunca verde otimista). Hoje
 * isso é o tempo todo, porque este repositório não expõe `/api/forge/health`
 * nem nada equivalente para núcleo/guardião — só `/api/forge/git-status`,
 * que é dado real e é o que alimenta o segmento de branch da StatusBar.
 */
export type HealthState = "ok" | "warn" | "fail" | "none";

const COLOR: Record<HealthState, string> = {
  ok: "bg-luna-ok",
  warn: "bg-luna-warn",
  fail: "bg-luna-fail",
  none: "bg-[var(--luna-text-3)]",
};

export function HealthDot({ state, className = "" }: { state: HealthState; className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={`block h-[0.45rem] w-[0.45rem] flex-none rounded-full ${COLOR[state]} ${className}`}
    />
  );
}
