/**
 * Reenvio automático (ADR-021 Fase 1): "ao detectar evento `online` (não
 * Background Sync API — suporte inconsistente no Safari/iOS), ou ao reabrir
 * o app, tenta reenviar o que estiver pendente." Nenhuma ação manual do
 * usuário além de reconectar.
 */
import { listQueue, updateQueueItem, deleteQueueItem, type QueueItem } from "./db";
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

/** Tenta enviar todo item "pending"/"error" da fila, um de cada vez (evita disparar N requisições simultâneas de foto grande na primeira reconexão). */
export async function trySyncPendingRondas(onProgress?: (item: QueueItem) => void): Promise<void> {
  if (syncing) return; // evita corridas: evento 'online' + chamada manual ao mesmo tempo
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  syncing = true;
  try {
    const items = await listQueue();
    const toSend = items.filter((item) => item.status === "pending" || item.status === "error");

    for (const item of toSend) {
      await updateQueueItem(item.localId, { status: "syncing" });
      onProgress?.({ ...item, status: "syncing" });
      try {
        const result = await submitRonda(item.submission);
        await updateQueueItem(item.localId, { status: "synced", syncedAt: new Date().toISOString(), serverRondaId: result.rondaId, lastError: undefined });
        onProgress?.({ ...item, status: "synced", serverRondaId: result.rondaId });
      } catch (error) {
        const message = error instanceof RondaSubmitError ? error.message : error instanceof Error ? error.message : "Falha desconhecida ao enviar.";
        // Achado real em produção: itens enfileirados antes da migração pra
        // achado dinâmico (categoria em vez de id/flagId) ficavam presos em
        // "error" e eram retentados pra sempre em todo reconecte/reabertura
        // do app, gerando 422 repetido sem nunca se resolver. "invalid" tira
        // esses itens do loop de retry automático (ver isPermanentRejection).
        const permanent = isPermanentRejection(error);
        const nextStatus = permanent ? "invalid" : "error";
        const nextMessage = permanent
          ? `Este registro não pode ser reenviado automaticamente (rejeitado pelo servidor: ${message}). Refaça esta ronda e descarte este item da fila.`
          : message;
        await updateQueueItem(item.localId, { status: nextStatus, lastError: nextMessage, attempts: item.attempts + 1 });
        onProgress?.({ ...item, status: nextStatus, lastError: nextMessage });
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
