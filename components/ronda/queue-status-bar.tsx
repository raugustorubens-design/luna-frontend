"use client";

import { signIn } from "next-auth/react";
import type { QueueCounts, QueueItem } from "@/lib/ronda/db";
import { canDiscardInvalidItem } from "@/lib/ronda/issues";

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
    <div className="border-b border-black/10 bg-black/5 text-xs dark:border-[rgba(112,136,160,0.16)] dark:bg-black/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${counts.pending > 0 ? "bg-amber-400" : "bg-transparent"}`} />
            {counts.pending} pendente{counts.pending === 1 ? "" : "s"}
          </span>
          {counts.syncing > 0 && (
            <span className="flex items-center gap-1.5 text-[#003C90] dark:text-[#A0B8C8]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#003C90] dark:bg-[#A0B8C8]" />
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
          {counts.unauthenticated > 0 && (
            <span className="flex items-center gap-1.5 text-sky-400">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              {counts.unauthenticated} aguardando login
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
            className="shrink-0 rounded border border-black/20 px-2 py-1 text-[11px] text-[#1E3A61] hover:border-[#003C90] hover:text-[#003C90] dark:border-[rgba(112,136,160,0.28)] dark:text-[#A8BBD4] dark:hover:border-[#A0B8C8] dark:hover:text-[#A0B8C8]"
          >
            Tentar enviar agora
          </button>
        )}
      </div>
      {counts.invalid > 0 && (
        <div className="flex flex-col gap-2 border-t border-orange-400/30 bg-orange-400/10 px-4 py-2 text-orange-900 dark:text-orange-200">
          <p>
            {counts.invalid} registro{counts.invalid === 1 ? "" : "s"} desta fila {counts.invalid === 1 ? "foi" : "foram"} rejeitado
            {counts.invalid === 1 ? "" : "s"} pelo servidor e não {counts.invalid === 1 ? "vai" : "vão"} se resolver tentando de novo — abra a ronda em
            {" "}&quot;Ver rondas anteriores&quot; pra ver o motivo. Se for campo faltando, corrija e salve ali; se for formato antigo, refaça e descarte.
          </p>
          {invalidItems.map((item) => {
            // Mesma checagem de `ronda-editor.tsx` (`canDiscardInvalidItem`):
            // "Descartar" só aparece quando não há nada corrigível nesta
            // ronda — nem no gate do cliente sobre o conteúdo carregado, nem
            // numa issue do servidor que ainda mapeia pra um achado da lista.
            const allowDiscard = canDiscardInvalidItem(item.submission.achados, item.issues);
            return (
              <div key={item.localId} className="flex items-center justify-between gap-2 rounded border border-orange-400/40 bg-black/5 px-2 py-1 dark:bg-black/20">
                <span className="truncate">
                  {item.submission.metadata.titulo || "(sem título)"} — {item.submission.metadata.data} — {item.lastError ?? "Rejeitado pelo servidor."}
                </span>
                {onDiscardInvalid && allowDiscard && (
                  <button
                    type="button"
                    onClick={() => onDiscardInvalid(item.localId)}
                    className="shrink-0 rounded border border-orange-400/50 px-2 py-1 text-[11px] hover:border-orange-500"
                  >
                    Descartar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/*
        `2026-08-19-acesso-publico.md`, Etapa 3, armadilha (b) — distinto do
        bloco "invalid" acima: aqui o achado está correto, só falta sessão.
        Nada de "descartar"/"refazer" — o único botão útil é logar de novo;
        assim que a sessão voltar, o item some sozinho deste bloco (volta
        pra "pending" via `reclaimUnauthenticated`, `lib/ronda/queue.ts`).
      */}
      {counts.unauthenticated > 0 && (
        <div className="flex flex-col gap-2 border-t border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sky-900 dark:text-sky-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              {counts.unauthenticated} registro{counts.unauthenticated === 1 ? "" : "s"} não {counts.unauthenticated === 1 ? "pôde" : "puderam"} ser
              {" "}enviado{counts.unauthenticated === 1 ? "" : "s"} porque a sessão expirou. O achado está correto — entre de novo pra continuar o envio.
            </p>
            <button
              type="button"
              onClick={() => void signIn("google", { callbackUrl: typeof window !== "undefined" ? window.location.href : "/ronda/historico" })}
              className="shrink-0 rounded border border-sky-400/50 px-2 py-1 text-[11px] hover:border-sky-500"
            >
              Entrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
