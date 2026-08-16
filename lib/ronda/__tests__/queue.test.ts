import assert from "node:assert/strict";
import test from "node:test";
import { isPermanentRejection, reclaimStaleSyncingItems } from "../queue";
import type { QueueItem } from "../db";
import { RondaSubmitError } from "../api-client";

test("isPermanentRejection is true for a 422 validation rejection", () => {
  assert.equal(isPermanentRejection(new RondaSubmitError("Envio de ronda reprovado na validação.", [{ path: "achados.0.id", message: "Required" }], 422)), true);
});

test("isPermanentRejection is false for a network/5xx failure", () => {
  assert.equal(isPermanentRejection(new RondaSubmitError("Falha ao enviar ronda (HTTP 500).", undefined, 500)), false);
  assert.equal(isPermanentRejection(new TypeError("Failed to fetch")), false);
  assert.equal(isPermanentRejection(new RondaSubmitError("sem status")), false);
});

/**
 * Achado de campo 16/08/2026: a barra de status mostrava "1 enviando…"
 * indefinidamente e o item nunca mais era reenviado — `trySyncPendingRondas`
 * só olhava "pending"/"error", então uma aba que morreu no meio do envio
 * deixava a ronda presa em "syncing" pra sempre.
 */
function queued(status: QueueItem["status"], localId: string): QueueItem {
  return {
    localId,
    submission: { metadata: { titulo: "x", data: "2026-08-16", local: "x", responsavel: "x", turno: "x" }, achados: [], encerramento: { incluirGraficoResumo: false } },
    status,
    createdAt: "2026-08-16T14:00:00.000Z",
    attempts: 0,
  };
}

test("reclaimStaleSyncingItems devolve item preso em 'syncing' para a fila de envio", () => {
  const reclaimed = reclaimStaleSyncingItems([queued("syncing", "presa")]);
  assert.equal(reclaimed[0].status, "pending");
  assert.equal(reclaimed[0].localId, "presa");
  // O que importa de fato: depois da recuperação o item volta a ser elegível
  // pro mesmo filtro que `trySyncPendingRondas` aplica.
  assert.equal(reclaimed.filter((i) => i.status === "pending" || i.status === "error").length, 1);
});

test("reclaimStaleSyncingItems não mexe nos outros status", () => {
  const original = [queued("pending", "a"), queued("synced", "b"), queued("error", "c"), queued("invalid", "d")];
  assert.deepEqual(
    reclaimStaleSyncingItems(original).map((i) => i.status),
    ["pending", "synced", "error", "invalid"],
  );
});

test("reclaimStaleSyncingItems limpa o erro herdado da tentativa interrompida", () => {
  const stale: QueueItem = { ...queued("syncing", "presa"), lastError: "Falha ao enviar ronda (HTTP 500)." };
  assert.equal(reclaimStaleSyncingItems([stale])[0].lastError, undefined);
});
