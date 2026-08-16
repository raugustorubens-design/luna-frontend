"use client";

import { useCallback, useEffect, useState } from "react";
import { listQueue, listHistory, summarizeQueue, type QueueItem, type QueueCounts, type HistoryEntry } from "./db";
import { registerAutoSync, trySyncPendingRondas, discardInvalidQueueItem } from "./queue";

/** Estado da fila offline, reativo — usado pela barra de status (pendente vs. confirmado no servidor) e para disparar reenvio automático (evento `online` + reabertura do app, ADR-021). */
export function useRondaQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    // A ronda confirmada deixou de ficar guardada inteira na fila (ver
    // `discardRondaLocalCopies`), então "quantas já subiram" passou a ser uma
    // contagem do histórico, não mais do store da fila.
    const [next, confirmed] = await Promise.all([listQueue(), listHistory()]);
    setItems(next);
    setHistory(confirmed);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    const unregister = registerAutoSync(() => {
      void refresh();
    });
    return unregister;
  }, [refresh]);

  const syncNow = useCallback(async () => {
    await trySyncPendingRondas(() => {
      void refresh();
    });
    await refresh();
  }, [refresh]);

  const discardInvalid = useCallback(
    async (localId: string) => {
      await discardInvalidQueueItem(localId);
      await refresh();
    },
    [refresh],
  );

  const counts: QueueCounts = { ...summarizeQueue(items), synced: history.length };

  return { items, history, counts, loaded, refresh, syncNow, discardInvalid };
}
