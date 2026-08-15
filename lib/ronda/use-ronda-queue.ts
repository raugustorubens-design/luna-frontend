"use client";

import { useCallback, useEffect, useState } from "react";
import { listQueue, summarizeQueue, type QueueItem, type QueueCounts } from "./db";
import { registerAutoSync, trySyncPendingRondas, discardInvalidQueueItem } from "./queue";

/** Estado da fila offline, reativo — usado pela barra de status (pendente vs. confirmado no servidor) e para disparar reenvio automático (evento `online` + reabertura do app, ADR-021). */
export function useRondaQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const next = await listQueue();
    setItems(next);
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

  const counts: QueueCounts = summarizeQueue(items);

  return { items, counts, loaded, refresh, syncNow, discardInvalid };
}
