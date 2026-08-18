"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listRondas, RondaSubmitError, type RondaSubmitResult } from "@/lib/ronda/api-client";
import { cacheHistory } from "@/lib/ronda/db";
import { getLastSessionSummaryAndCleanup } from "@/lib/ronda/diagnostics";
import { buildRondaList, ENTRY_STATUS_LABEL, type RondaListEntry } from "@/lib/ronda/list-view";
import { useRondaQueue } from "@/lib/ronda/use-ronda-queue";

/**
 * Lista de rondas — do servidor e do aparelho, numa lista só (achado de
 * campo 16/08/2026, ver `lib/ronda/list-view.ts`). Continua sem
 * dashboard/filtro/gráfico: isso é o painel de gestão completo, decisão
 * maior ainda pendente (P3 do documento de extensão do ADR-021). O que
 * mudou não foi a ambição da tela, foi o conjunto que ela enxerga.
 */

/** Cores por estado. Classes estáticas, não template dinâmico — o JIT do Tailwind precisa ver a string inteira no código pra gerar a classe. */
const STATUS_CLASS: Record<string, string> = {
  server: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  pending: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  syncing: "border-cyan-500/40 text-cyan-700 dark:text-cyan-300",
  synced: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  error: "border-red-500/40 text-red-700 dark:text-red-300",
  invalid: "border-orange-500/40 text-orange-700 dark:text-orange-300",
};

function StatusTag({ entry }: { entry: RondaListEntry }) {
  const key = entry.kind === "server" ? "server" : entry.status;
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CLASS[key] ?? STATUS_CLASS.pending}`}>
      {ENTRY_STATUS_LABEL[key as keyof typeof ENTRY_STATUS_LABEL]}
    </span>
  );
}

export function RondaList() {
  const { items: queueItems, history, counts, refresh, syncNow } = useRondaQueue();
  /** `null` = ainda carregando ou servidor inalcançável; `[]` = servidor respondeu vazio. `buildRondaList` trata os dois casos de forma diferente. */
  const [server, setServer] = useState<RondaSubmitResult[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [diagnosticsSummary, setDiagnosticsSummary] = useState<{ started: number; completed: number } | null>(null);

  // Lê o resumo da sessão anterior de instrumentação de foto (PR 3 — ver
  // `lib/ronda/diagnostics.ts`) e aproveita pra descartar o que já não tem
  // valor diagnóstico. Uma vez por montagem: nem toda sessão de fato muda o
  // resumo, e a limpeza não precisa rodar mais que isso.
  useEffect(() => {
    void getLastSessionSummaryAndCleanup().then(setDiagnosticsSummary);
  }, []);

  const loadServer = useCallback(async () => {
    setLoading(true);
    try {
      const rondas = await listRondas();
      setServer(rondas);
      setServerError(null);
      // Espelha o que o servidor devolveu no cache local — é o que mantém
      // esta mesma tela útil da próxima vez que ela abrir sem rede.
      await cacheHistory(rondas);
      await refresh();
    } catch (err: unknown) {
      // Falha do servidor não esvazia mais a tela: os itens do aparelho
      // continuam listados abaixo do aviso. Em campo, sem rede, esta era
      // justamente a tela que aparecia vazia bem quando mais importava.
      setServer(null);
      setServerError(err instanceof RondaSubmitError ? err.message : "Sem conexão com o servidor — mostrando só o que está neste aparelho.");
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void loadServer();
  }, [loadServer]);

  const entries = buildRondaList(server, queueItems, history);
  const localCount = entries.filter((entry) => entry.kind === "queue").length;

  return (
    <div className="ronda-shell flex flex-col overflow-hidden">
      <header className="ronda-chrome-top shrink-0 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">LUNA Safety Walk — rondas</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Toque numa ronda para editar achados ou a observação geral.
          {localCount > 0 && ` ${localCount} ainda ${localCount === 1 ? "está" : "estão"} neste aparelho.`}
        </p>
        {/*
          Linha discreta, não painel — instrumentação mínima (PR 3), só pra
          um "iniciada sem concluída" da sessão anterior não passar
          despercebido. `completed < started` é a assinatura de uma aba
          descartada no meio da compressão; sem instrumentação isso não
          deixava rastro nenhum.
        */}
        {diagnosticsSummary && (
          <p className="text-[10px] text-slate-500 dark:text-slate-500">
            Sessão anterior: {diagnosticsSummary.completed}/{diagnosticsSummary.started} compressões de foto concluídas
            {diagnosticsSummary.completed < diagnosticsSummary.started && " — alguma pode ter sido interrompida"}
          </p>
        )}
      </header>

      <main className="ronda-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {serverError && (
          <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <p>{serverError}</p>
            <button type="button" onClick={() => void loadServer()} className="mt-1 underline">
              Tentar de novo
            </button>
          </div>
        )}

        {loading && server === null && !serverError && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando…</p>}

        {!loading && entries.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ronda ainda.</p>}

        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={`${entry.kind}:${entry.id}`}>
              <Link
                href={entry.kind === "server" ? `/ronda/historico/${entry.id}` : `/ronda/fila/${entry.id}`}
                className="flex flex-col gap-1 rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.titulo || "(sem título)"}</span>
                  <StatusTag entry={entry} />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {entry.data} — {entry.local} — {entry.achadosCount} achado{entry.achadosCount === 1 ? "" : "s"}
                </span>
                {entry.kind === "queue" && entry.lastError && <span className="text-xs text-red-500 dark:text-red-400">{entry.lastError}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <footer className="ronda-chrome-bottom flex shrink-0 items-center justify-between gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10">
        <Link href="/ronda" className="rounded border border-black/15 px-4 py-2 text-sm text-slate-700 dark:border-white/15 dark:text-slate-300">
          Nova ronda
        </Link>
        {counts.pending + counts.error + counts.syncing > 0 && (
          <button
            type="button"
            onClick={() => {
              void syncNow().then(() => loadServer());
            }}
            className="rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-black"
          >
            Enviar pendentes
          </button>
        )}
      </footer>
    </div>
  );
}
