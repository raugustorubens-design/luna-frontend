"use client";

import type { QueueCounts } from "@/lib/ronda/db";

/**
 * "Usuário precisa conseguir ver, na própria tela, quantos achados estão
 * pendentes de envio vs. já confirmados no servidor — não pode ser
 * silencioso" (ADR-021 Fase 1). Uma ronda = um item na fila; "achados"
 * aqui é usado no sentido do texto do ADR (o que o usuário coletou), não
 * uma contagem por achado individual.
 */
export function QueueStatusBar({ counts, onSyncNow }: { counts: QueueCounts; onSyncNow: () => void }) {
  const hasPending = counts.pending > 0 || counts.error > 0;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/30 px-4 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${counts.pending > 0 ? "bg-amber-400" : "bg-transparent"}`} />
          {counts.pending} pendente{counts.pending === 1 ? "" : "s"}
        </span>
        {counts.syncing > 0 && (
          <span className="flex items-center gap-1.5 text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            {counts.syncing} enviando…
          </span>
        )}
        {counts.error > 0 && (
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {counts.error} falhou{counts.error === 1 ? "" : "ram"}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {counts.synced} confirmada{counts.synced === 1 ? "" : "s"} no servidor
        </span>
      </div>
      {hasPending && (
        <button
          type="button"
          onClick={onSyncNow}
          className="shrink-0 rounded border border-white/20 px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-400 hover:text-cyan-300"
        >
          Tentar enviar agora
        </button>
      )}
    </div>
  );
}
