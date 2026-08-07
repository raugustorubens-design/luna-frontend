/**
 * Reenvio automático (ADR-021 Fase 1): "ao detectar evento `online` (não
 * Background Sync API — suporte inconsistente no Safari/iOS), ou ao reabrir
 * o app, tenta reenviar o que estiver pendente." Nenhuma ação manual do
 * usuário além de reconectar.
 */
import { listQueue, updateQueueItem, type QueueItem } from "./db";
import { submitRonda, RondaSubmitError } from "./api-client";

let syncing = false;

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
        await updateQueueItem(item.localId, { status: "error", lastError: message, attempts: item.attempts + 1 });
        onProgress?.({ ...item, status: "error", lastError: message });
        // Uma falha (ex. rede caiu de novo no meio da fila) não deve
        // impedir a tentativa dos outros itens pendentes — continua o loop
        // em vez de abortar tudo no primeiro erro.
      }
    }
  } finally {
    syncing = false;
  }
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
