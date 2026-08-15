"use client";

import type { QueueCounts, QueueItem } from "@/lib/ronda/db";

/**
 * "Usuário precisa conseguir ver, na própria tela, quantos achados estão
 * pendentes de envio vs. já confirmados no servidor — não pode ser
 * silencioso" (ADR-021 Fase 1). Uma ronda = um item na fila; "achados"
 * aqui é usado no sentido do texto do ADR (o que o usuário coletou), não
 * uma contagem por achado individual.
 */
export function QueueStatusBar({
  counts,
  onSyncNow,
  invalidItems = [],
  onDiscardInvalid,
}: {
  counts: QueueCounts;
  onSyncNow: () => void;
  invalidItems?: QueueItem[];
  onDiscardInvalid?: (localId: string) => void;
}) {
  const hasPending = counts.pending > 0 || counts.error > 0;

  return (
    <div className="border-b border-black/10 bg-black/5 text-xs dark:border-white/10 dark:bg-black/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
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
          {counts.invalid > 0 && (
            <span className="flex items-center gap-1.5 text-orange-400">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              {counts.invalid} não pôde{counts.invalid === 1 ? "" : "ram"} ser reenviada{counts.invalid === 1 ? "" : "s"}
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
            className="shrink-0 rounded border border-black/20 px-2 py-1 text-[11px] text-slate-800 hover:border-cyan-500 hover:text-cyan-600 dark:border-white/20 dark:text-slate-200 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
          >
            Tentar enviar agora
          </button>
        )}
      </div>
      {counts.invalid > 0 && (
        <div className="flex flex-col gap-2 border-t border-orange-400/30 bg-orange-400/10 px-4 py-2 text-orange-900 dark:text-orange-200">
          <p>
            {counts.invalid} registro{counts.invalid === 1 ? "" : "s"} desta fila {counts.invalid === 1 ? "foi" : "foram"} rejeitado
            {counts.invalid === 1 ? "" : "s"} pelo servidor e não {counts.invalid === 1 ? "vai" : "vão"} se resolver tentando de novo — provavelmente
            {" "}foi{counts.invalid === 1 ? "" : "am"} salvo{counts.invalid === 1 ? "" : "s"} num formato antigo. Refaça a ronda pelo formulário e depois
            descarte o item abaixo.
          </p>
          {invalidItems.map((item) => (
            <div key={item.localId} className="flex items-center justify-between gap-2 rounded border border-orange-400/40 bg-black/5 px-2 py-1 dark:bg-black/20">
              <span className="truncate">
                {item.submission.metadata.titulo || "(sem título)"} — {item.submission.metadata.data} — {item.lastError ?? "Rejeitado pelo servidor."}
              </span>
              {onDiscardInvalid && (
                <button
                  type="button"
                  onClick={() => onDiscardInvalid(item.localId)}
                  className="shrink-0 rounded border border-orange-400/50 px-2 py-1 text-[11px] hover:border-orange-500"
                >
                  Descartar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
