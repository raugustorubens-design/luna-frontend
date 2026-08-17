"use client";

import Link from "next/link";
import type { QueueCounts, QueueItem } from "@/lib/ronda/db";
import { findingsWithMissingFields } from "@/lib/ronda/types";
import { classifyQueueRejection } from "@/lib/ronda/issues";

/**
 * Gate divergente de 17/08/2026 (mesmo princípio da Etapa 3, aplicado aqui
 * também): esta barra é a primeira coisa que aparece ao abrir `/ronda`, e
 * até esta correção presumia, para todo item "invalid", que era formato
 * antigo — sem verificar. Com `issues` guardadas, a classificação vem
 * delas; sem elas (item preso antes desta mudança), cai pro gate do
 * cliente sobre o próprio payload salvo.
 */
function isRecoverable(item: QueueItem): boolean {
  if (item.issues && item.issues.length > 0) return classifyQueueRejection(item.issues) === "recoverable";
  return findingsWithMissingFields(item.submission.achados).length > 0;
}

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
          {/*
            Gate divergente de 17/08/2026: o texto antigo presumia "formato
            antigo" para todo item "invalid" sem verificar — que é
            exatamente a instrução errada para um item que só está faltando
            um campo. Cada linha abaixo já diz o que o servidor recusou
            (`item.lastError`); esta frase não repete um diagnóstico que
            pode estar errado.
          */}
          <p>
            {counts.invalid} registro{counts.invalid === 1 ? "" : "s"} desta fila {counts.invalid === 1 ? "foi" : "foram"} rejeitado
            {counts.invalid === 1 ? "" : "s"} pelo servidor e não {counts.invalid === 1 ? "vai" : "vão"} se resolver tentando de novo.
          </p>
          {invalidItems.map((item) => {
            const recoverable = isRecoverable(item);
            return (
              <div
                key={item.localId}
                className="flex items-center justify-between gap-2 rounded border border-orange-400/40 bg-black/5 px-2 py-1 dark:bg-black/20"
              >
                <span className="truncate">
                  {item.submission.metadata.titulo || "(sem título)"} — {item.submission.metadata.data} — {item.lastError ?? "Rejeitado pelo servidor."}
                </span>
                {/*
                  Etapa 3: recuperável leva a corrigir, nunca a descartar —
                  as fotos daquele achado só existem neste aparelho.
                */}
                {recoverable ? (
                  <Link
                    href={`/ronda/fila/${item.localId}`}
                    className="shrink-0 rounded border border-cyan-500/50 px-2 py-1 text-[11px] text-cyan-700 hover:border-cyan-600 dark:text-cyan-300 dark:hover:border-cyan-400"
                  >
                    Corrigir
                  </Link>
                ) : (
                  onDiscardInvalid && (
                    <button
                      type="button"
                      onClick={() => onDiscardInvalid(item.localId)}
                      className="shrink-0 rounded border border-orange-400/50 px-2 py-1 text-[11px] hover:border-orange-500"
                    >
                      Descartar
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
