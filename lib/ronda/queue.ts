/**
 * Reenvio automático (ADR-021 Fase 1): "ao detectar evento `online` (não
 * Background Sync API — suporte inconsistente no Safari/iOS), ou ao reabrir
 * o app, tenta reenviar o que estiver pendente." Nenhuma ação manual do
 * usuário além de reconectar.
 */
import { getSession } from "next-auth/react";
import { listQueue, updateQueueItem, deleteQueueItem, discardRondaLocalCopies, type QueueItem } from "./db";
import { submitRonda, RondaSubmitError } from "./api-client";

let syncing = false;

/**
 * 422 é uma rejeição definitiva do backend (validação estrutural/semântica,
 * ver validateRondaSubmission em luna-core) — reenviar o mesmo payload de
 * novo vai falhar sempre da mesma forma. Qualquer outro erro (rede, 5xx) é
 * tratado como transiente e continua elegível a retry automático.
 */
export function isPermanentRejection(error: unknown): boolean {
  return error instanceof RondaSubmitError && error.status === 422;
}

/**
 * 401 (`2026-08-19-acesso-publico.md`, Etapa 3, armadilha b): a sessão
 * expirou, não o dado nem a rede. Reenviar o mesmo payload sem sessão
 * válida vai falhar de novo do mesmo jeito — mesmo raciocínio de
 * `isPermanentRejection`, causa diferente. O achado em si está correto,
 * só falta confirmar quem está enviando.
 */
export function isSessionExpiredRejection(error: unknown): boolean {
  return error instanceof RondaSubmitError && error.status === 401;
}

/**
 * Devolve à fila os itens presos em "syncing" — achado de campo em
 * 16/08/2026 (barra de status mostrando "1 enviando…" indefinidamente, com
 * uma ronda inteira dentro).
 *
 * `trySyncPendingRondas` grava "syncing" *antes* de disparar a requisição.
 * Se a aba morre no meio (Chrome descartando aba em segundo plano, app
 * fechado, rede pendurada), o item fica gravado como "syncing" pra sempre —
 * e o filtro de reenvio só pegava "pending"/"error". Resultado: ronda
 * íntegra no IndexedDB, invisível pra todo mecanismo de retry, sem nenhuma
 * forma de destravar pela interface.
 *
 * Só é chamada de dentro de `trySyncPendingRondas`, logo depois do guarda
 * `if (syncing) return` — ou seja, num momento em que sabidamente não há
 * envio em curso *nesta* aba. Todo "syncing" que sobrou no banco é,
 * portanto, herança de uma sessão que não existe mais.
 *
 * Risco assumido conscientemente: se a requisição chegou a completar no
 * servidor e só o registro local do sucesso se perdeu, o reenvio cria uma
 * ronda duplicada. Duplicata é visível e descartável pelo histórico; ronda
 * perdida em campo não se recupera de jeito nenhum. Enquanto o backend não
 * aceitar `localId` como chave de idempotência (pendência a levar pra
 * luna-core), essa é a troca certa. Mesma ressalva pro caso raro de duas
 * abas abertas: a segunda pode reclamar um envio ainda em curso na primeira.
 */
/** Parte pura da recuperação (testável sem IndexedDB): "syncing" vira "pending", o resto passa intacto. */
export function reclaimStaleSyncingItems(items: QueueItem[]): QueueItem[] {
  return items.map((item) => (item.status === "syncing" ? { ...item, status: "pending", lastError: undefined } : item));
}

async function reclaimStaleSyncing(items: QueueItem[], onProgress?: (item: QueueItem) => void): Promise<QueueItem[]> {
  const reclaimed = reclaimStaleSyncingItems(items);
  for (const [index, item] of items.entries()) {
    if (item.status !== "syncing") continue;
    await updateQueueItem(item.localId, { status: "pending", lastError: undefined });
    onProgress?.(reclaimed[index]);
  }
  return reclaimed;
}

/**
 * Parte pura (testável sem IndexedDB/rede): com sessão válida,
 * "unauthenticated" vira "pending"; sem sessão, nada muda. O que resolve
 * "unauthenticated" é a pessoa logar de novo — a partir daí o item volta
 * pra "pending" sozinho, sem exigir descartar/refazer a ronda: o achado
 * está certo, só faltava sessão.
 */
export function reclaimUnauthenticatedItems(items: QueueItem[], hasSession: boolean): QueueItem[] {
  if (!hasSession) return items;
  return items.map((item) => (item.status === "unauthenticated" ? { ...item, status: "pending", lastError: undefined } : item));
}

/**
 * Devolve à fila os itens presos em "unauthenticated" — só quando há
 * sessão válida agora. Sem isto, o técnico logaria de novo (botão "Entrar"
 * de `QueueStatusBar`) e a ronda continuaria parada, porque nada além do
 * clique manual em "Tentar enviar agora" pegaria "unauthenticated" — que
 * nem é tentado ali (ver `toSend` abaixo, mesmo raciocínio de "invalid":
 * não insiste contra uma causa que insistir não resolve).
 *
 * `getSession()` faz um `fetch` a `/api/auth/session` — se isso falhar
 * (ex.: ainda offline), trata como "segue sem sessão" em vez de derrubar a
 * sincronização inteira; o item permanece "unauthenticated" e tenta de novo
 * no próximo gatilho (reconexão, reabertura, ou o próprio clique em
 * "Entrar" quando o login realmente completar).
 */
async function reclaimUnauthenticated(items: QueueItem[], onProgress?: (item: QueueItem) => void): Promise<QueueItem[]> {
  if (!items.some((item) => item.status === "unauthenticated")) return items;

  const session = await getSession().catch(() => null);
  const reclaimed = reclaimUnauthenticatedItems(items, Boolean(session?.user));
  for (const [index, item] of items.entries()) {
    if (item.status !== "unauthenticated" || reclaimed[index].status !== "pending") continue;
    await updateQueueItem(item.localId, { status: "pending", lastError: undefined });
    onProgress?.(reclaimed[index]);
  }
  return reclaimed;
}

/** Tenta enviar todo item "pending"/"error" da fila, um de cada vez (evita disparar N requisições simultâneas de foto grande na primeira reconexão). Itens órfãos em "syncing" voltam pra "pending" antes (`reclaimStaleSyncing`); itens "unauthenticated" voltam pra "pending" se já houver sessão válida (`reclaimUnauthenticated`). */
export async function trySyncPendingRondas(onProgress?: (item: QueueItem) => void): Promise<void> {
  if (syncing) return; // evita corridas: evento 'online' + chamada manual ao mesmo tempo
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  syncing = true;
  try {
    const afterSyncing = await reclaimStaleSyncing(await listQueue(), onProgress);
    const items = await reclaimUnauthenticated(afterSyncing, onProgress);
    const toSend = items.filter((item) => item.status === "pending" || item.status === "error");

    for (const item of toSend) {
      await updateQueueItem(item.localId, { status: "syncing" });
      onProgress?.({ ...item, status: "syncing" });
      try {
        const result = await submitRonda(item.submission);
        await updateQueueItem(item.localId, { status: "synced", syncedAt: new Date().toISOString(), serverRondaId: result.rondaId, lastError: undefined });
        onProgress?.({ ...item, status: "synced", serverRondaId: result.rondaId });
        // Confirmada no servidor — as cópias locais (item da fila com as
        // fotos comprimidas embutidas, e as originais dos achados) perdem a
        // razão de existir e dão lugar a um resumo de ~1 KB. Antes desta
        // linha nada apagava nada: medido em 16/08/2026, ~9,3 MB por foto
        // ficavam no aparelho para sempre.
        await discardRondaLocalCopies(item, {
          rondaId: result.rondaId,
          titulo: result.titulo,
          data: result.data,
          local: result.local,
          achadosCount: result.achadosCount,
          createdAt: result.createdAt,
        });
      } catch (error) {
        const message = error instanceof RondaSubmitError ? error.message : error instanceof Error ? error.message : "Falha desconhecida ao enviar.";
        const issues = error instanceof RondaSubmitError ? error.issues : undefined;
        // Achado real em produção: itens enfileirados antes da migração pra
        // achado dinâmico (categoria em vez de id/flagId) ficavam presos em
        // "error" e eram retentados pra sempre em todo reconecte/reabertura
        // do app, gerando 422 repetido sem nunca se resolver. "invalid" tira
        // esses itens do loop de retry automático (ver isPermanentRejection).
        //
        // A mensagem aqui só descreve o que aconteceu — não prescreve "refaça
        // e descarte" nem "corrija e salve": essa decisão depende de o
        // registro ser recuperável (campo faltando) ou não (formato antigo),
        // e só `RondaEditor` tem o que precisa pra decidir (o gate do
        // cliente sobre o conteúdo carregado, ver `lib/ronda/issues.ts`).
        const permanent = isPermanentRejection(error);
        const sessionExpired = !permanent && isSessionExpiredRejection(error);
        const nextStatus = permanent ? "invalid" : sessionExpired ? "unauthenticated" : "error";
        const nextMessage = permanent
          ? `Este registro não pode ser reenviado automaticamente (rejeitado pelo servidor: ${message}).`
          : sessionExpired
            ? "Sessão expirada — entre novamente para continuar o envio. O achado está correto, só falta confirmar login."
            : message;
        await updateQueueItem(item.localId, { status: nextStatus, lastError: nextMessage, issues, attempts: item.attempts + 1 });
        onProgress?.({ ...item, status: nextStatus, lastError: nextMessage, issues });
        // Uma falha (ex. rede caiu de novo no meio da fila) não deve
        // impedir a tentativa dos outros itens pendentes — continua o loop
        // em vez de abortar tudo no primeiro erro.
      }
    }
  } finally {
    syncing = false;
  }
}

/** Descarta um item "invalid" da fila local — usuário já refez a ronda manualmente, não há reenvio automático possível pra esse registro (ver comentário em trySyncPendingRondas). */
export async function discardInvalidQueueItem(localId: string): Promise<void> {
  await deleteQueueItem(localId);
}

/** Registra os dois gatilhos de reenvio automático do ADR-021: reconexão (evento `online`) e reabertura do app (chamada no mount do wizard). Devolve uma função de limpeza (remover o listener). */
export function registerAutoSync(onProgress?: (item: QueueItem) => void): () => void {
  const handler = () => {
    void trySyncPendingRondas(onProgress);
  };
  window.addEventListener("online", handler);
  void trySyncPendingRondas(onProgress); // reabertura do app / primeira carga com rede já disponível
  return () => window.removeEventListener("online", handler);
}
