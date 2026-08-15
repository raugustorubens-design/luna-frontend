import assert from "node:assert/strict";
import test from "node:test";
import { summarizeQueue, type QueueItem } from "../db";

function item(status: QueueItem["status"]): QueueItem {
  return {
    localId: `id-${Math.random()}`,
    submission: { metadata: { titulo: "x", data: "2026-08-06", local: "x", responsavel: "x", turno: "x" }, achados: [], encerramento: { incluirGraficoResumo: false } },
    status,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
}

test("summarizeQueue counts each status independently", () => {
  const items = [item("pending"), item("pending"), item("syncing"), item("synced"), item("synced"), item("synced"), item("error"), item("invalid")];
  const counts = summarizeQueue(items);
  assert.deepEqual(counts, { pending: 2, syncing: 1, synced: 3, error: 1, invalid: 1 });
});

test("summarizeQueue on an empty queue is all zeros", () => {
  assert.deepEqual(summarizeQueue([]), { pending: 0, syncing: 0, synced: 0, error: 0, invalid: 0 });
});
