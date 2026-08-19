import assert from "node:assert/strict";
import test from "node:test";
import { summarizeQueue, assertQueueableSubmission, RondaQueueValidationError, type QueueItem } from "../db";
import type { RondaSubmission } from "../types";

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
  const items = [
    item("pending"),
    item("pending"),
    item("syncing"),
    item("synced"),
    item("synced"),
    item("synced"),
    item("error"),
    item("invalid"),
    item("unauthenticated"),
  ];
  const counts = summarizeQueue(items);
  assert.deepEqual(counts, { pending: 2, syncing: 1, synced: 3, error: 1, invalid: 1, unauthenticated: 1 });
});

test("summarizeQueue on an empty queue is all zeros", () => {
  assert.deepEqual(summarizeQueue([]), { pending: 0, syncing: 0, synced: 0, error: 0, invalid: 0, unauthenticated: 0 });
});

// Pacote "gate com link ao campo" — o gate do cliente vira invariante da
// fila (`assertQueueableSubmission`, chamada por `enqueueRonda` e
// `updateQueueSubmission`), não só do botão. Parte pura, testável sem
// IndexedDB, mesmo padrão de `reclaimStaleSyncingItems` em `queue.ts`.

const baseMetadata = { titulo: "x", data: "2026-08-19", local: "x", responsavel: "x", turno: "x" };

test("assertQueueableSubmission recusa submissão com achado identificado sem os campos obrigatórios", () => {
  const submission: RondaSubmission = {
    metadata: baseMetadata,
    achados: [{ id: "a1", estado: "identificado" }],
    encerramento: { incluirGraficoResumo: false },
  };
  assert.throws(() => assertQueueableSubmission(submission), RondaQueueValidationError);
});

test("assertQueueableSubmission aceita achado identificado com os 4 campos preenchidos", () => {
  const submission: RondaSubmission = {
    metadata: baseMetadata,
    achados: [{ id: "a1", estado: "identificado", departamento: "d", classificacao: "positivo", gravidade: "baixa", descricao: "d" }],
    encerramento: { incluirGraficoResumo: false },
  };
  assert.doesNotThrow(() => assertQueueableSubmission(submission));
});

test("assertQueueableSubmission aceita achado 'não avaliado' ou 'inexistente' mesmo sem os 4 campos — a regra só vale para 'identificado'", () => {
  const submission: RondaSubmission = {
    metadata: baseMetadata,
    achados: [
      { id: "a1", estado: "nao_avaliado" },
      { id: "a2", estado: "inexistente" },
    ],
    encerramento: { incluirGraficoResumo: false },
  };
  assert.doesNotThrow(() => assertQueueableSubmission(submission));
});

test("assertQueueableSubmission aceita ronda sem achado nenhum", () => {
  const submission: RondaSubmission = { metadata: baseMetadata, achados: [], encerramento: { incluirGraficoResumo: false } };
  assert.doesNotThrow(() => assertQueueableSubmission(submission));
});
