import assert from "node:assert/strict";
import test from "node:test";
import { buildRondaList, countIdentified, ENTRY_STATUS_LABEL } from "../list-view";
import type { QueueItem } from "../db";
import type { RondaSubmitResult } from "../api-client";
import type { RondaFinding } from "../types";

function finding(estado: RondaFinding["estado"]): RondaFinding {
  return { id: `f-${estado}-${Math.random()}`, estado };
}

function queued(overrides: Partial<QueueItem> & { localId: string; status: QueueItem["status"] }): QueueItem {
  return {
    submission: {
      metadata: { titulo: "Local", data: "2026-08-16", local: "UT", responsavel: "R", turno: "A" },
      achados: [],
      encerramento: { incluirGraficoResumo: false },
    },
    createdAt: "2026-08-16T10:00:00.000Z",
    attempts: 0,
    ...overrides,
  };
}

function serverRonda(overrides: Partial<RondaSubmitResult> = {}): RondaSubmitResult {
  return { rondaId: "ronda_1", titulo: "Servidor", data: "2026-08-11", local: "UT", achadosCount: 0, createdAt: "2026-08-11T10:00:00.000Z", ...overrides };
}

test("buildRondaList junta servidor e fila local numa lista só", () => {
  const entries = buildRondaList([serverRonda()], [queued({ localId: "a", status: "pending" })]);
  assert.deepEqual(
    entries.map((e) => `${e.kind}:${e.id}`),
    ["queue:a", "server:ronda_1"], // 16/08 antes de 11/08
  );
});

test("buildRondaList ordena por data da ronda, mais recente primeiro, desempatando por createdAt", () => {
  const entries = buildRondaList(
    [serverRonda({ rondaId: "antiga", data: "2026-08-01" }), serverRonda({ rondaId: "recente", data: "2026-08-20" })],
    [
      queued({ localId: "mesmo-dia-cedo", status: "pending", createdAt: "2026-08-20T08:00:00.000Z" }),
      queued({ localId: "mesmo-dia-tarde", status: "pending", createdAt: "2026-08-20T18:00:00.000Z" }),
    ].map((i) => ({ ...i, submission: { ...i.submission, metadata: { ...i.submission.metadata, data: "2026-08-20" } } })),
  );
  assert.deepEqual(entries.map((e) => e.id), ["mesmo-dia-tarde", "mesmo-dia-cedo", "recente", "antiga"]);
});

/**
 * A distinção entre `null` e `[]` é o comportamento offline da tela: sem
 * servidor, o que já subiu continua listado (senão a tela fica vazia
 * justamente em campo); com servidor, o registro dele é o canônico e o
 * espelho local seria duplicata.
 */
test("item já sincronizado é omitido quando o servidor respondeu", () => {
  const entries = buildRondaList([serverRonda()], [queued({ localId: "espelho", status: "synced" })]);
  assert.deepEqual(entries.map((e) => e.id), ["ronda_1"]);
});

test("item já sincronizado aparece quando o servidor está inalcançável", () => {
  const entries = buildRondaList(null, [queued({ localId: "espelho", status: "synced" })]);
  assert.deepEqual(entries.map((e) => e.id), ["espelho"]);
});

test("todo estado da fila tem rótulo, inclusive o que trava a ronda", () => {
  for (const status of ["pending", "syncing", "synced", "error", "invalid"] as const) {
    assert.ok(ENTRY_STATUS_LABEL[status], `sem rótulo para ${status}`);
  }
  assert.ok(ENTRY_STATUS_LABEL.server);
});

test("erro do servidor viaja junto do item, pra tela poder mostrar o motivo", () => {
  const entries = buildRondaList([], [queued({ localId: "rejeitada", status: "invalid", lastError: "achados.0.id: Required" })]);
  assert.equal(entries[0].kind === "queue" && entries[0].lastError, "achados.0.id: Required");
});

/** Mesma regra do backend (`ronda-store.ts`): número que muda sozinho ao sincronizar faz a pessoa desconfiar de perda de dado. */
test("countIdentified conta só achado identificado, igual ao servidor", () => {
  const item = queued({ localId: "x", status: "pending" });
  item.submission.achados = [finding("identificado"), finding("identificado"), finding("nao_avaliado"), finding("inexistente")];
  assert.equal(countIdentified(item), 2);
});

/**
 * Cache de histórico (16/08/2026): a ronda confirmada deixou de ficar
 * guardada inteira no aparelho, então o que sustenta a lista sem rede
 * passou a ser o resumo de ~1 KB por ronda — sem isso, economizar espaço
 * teria custado o histórico offline.
 */
const historico = [{ rondaId: "ronda_hist", titulo: "Do cache", data: "2026-08-10", local: "UT", achadosCount: 3, createdAt: "2026-08-10T09:00:00.000Z" }];

test("sem servidor, a lista é montada a partir do cache local", () => {
  const entries = buildRondaList(null, [], historico);
  assert.deepEqual(entries.map((e) => `${e.kind}:${e.id}`), ["server:ronda_hist"]);
  assert.equal(entries[0].achadosCount, 3);
});

test("com servidor no ar, o cache é ignorado — o servidor é a fonte canônica", () => {
  const entries = buildRondaList([serverRonda()], [], historico);
  assert.deepEqual(entries.map((e) => e.id), ["ronda_1"]);
});

test("sem servidor, cache e fila local convivem na mesma lista", () => {
  const entries = buildRondaList(null, [queued({ localId: "pendente", status: "pending" })], historico);
  assert.deepEqual(entries.map((e) => `${e.kind}:${e.id}`), ["queue:pendente", "server:ronda_hist"]);
});

/** `discardRondaLocalCopies` normalmente apaga o item; se falhar, ele não pode virar duplicata do registro que já está listado. */
test("item 'synced' que sobrou não duplica a ronda já confirmada", () => {
  const sobra = queued({ localId: "sobra", status: "synced", serverRondaId: "ronda_hist" });
  const entries = buildRondaList(null, [sobra], historico);
  assert.deepEqual(entries.map((e) => `${e.kind}:${e.id}`), ["server:ronda_hist"]);
});
