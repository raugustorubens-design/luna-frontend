import assert from "node:assert/strict";
import test from "node:test";
import { hasOrphanedStart, lastCompletedSessionSummary, selectDiagnosticEventKeysToDiscard, summarizeCompressions } from "../diagnostics";
import type { DiagnosticEvent } from "../db";

let nextKey = 1;
function ev(partial: Partial<DiagnosticEvent> & Pick<DiagnosticEvent, "sessionId" | "kind" | "correlationId" | "at">): DiagnosticEvent {
  return { key: nextKey++, ...partial };
}

test("summarizeCompressions conta iniciadas e concluídas, ignorando outros tipos de evento", () => {
  const events: DiagnosticEvent[] = [
    ev({ sessionId: "s1", kind: "compression_started", correlationId: "p1", at: "2026-08-18T10:00:00.000Z" }),
    ev({ sessionId: "s1", kind: "compression_completed", correlationId: "p1", at: "2026-08-18T10:00:01.000Z" }),
    ev({ sessionId: "s1", kind: "compression_started", correlationId: "p2", at: "2026-08-18T10:00:02.000Z" }),
    ev({ sessionId: "s1", kind: "upload_requested", correlationId: "p1", at: "2026-08-18T10:00:03.000Z" }),
  ];
  assert.deepEqual(summarizeCompressions(events), { started: 2, completed: 1 });
});

test("hasOrphanedStart é falso quando todo início tem fim correspondente pelo mesmo correlationId", () => {
  const events: DiagnosticEvent[] = [
    ev({ sessionId: "s1", kind: "compression_started", correlationId: "p1", at: "2026-08-18T10:00:00.000Z" }),
    ev({ sessionId: "s1", kind: "compression_completed", correlationId: "p1", at: "2026-08-18T10:00:01.000Z" }),
    ev({ sessionId: "s1", kind: "upload_requested", correlationId: "p1", at: "2026-08-18T10:00:02.000Z" }),
    ev({ sessionId: "s1", kind: "upload_failed", correlationId: "p1", at: "2026-08-18T10:00:03.000Z", reason: "rede" }),
    ev({ sessionId: "s1", kind: "suggestion_requested", correlationId: "achado-1", at: "2026-08-18T10:00:04.000Z" }),
    ev({ sessionId: "s1", kind: "suggestion_answered", correlationId: "achado-1", at: "2026-08-18T10:00:05.000Z" }),
  ];
  assert.equal(hasOrphanedStart(events), false);
});

test("hasOrphanedStart é verdadeiro quando uma compressão inicia e não conclui — a assinatura do descarte de aba", () => {
  const events: DiagnosticEvent[] = [
    ev({ sessionId: "s1", kind: "compression_started", correlationId: "p1", at: "2026-08-18T10:00:00.000Z" }),
    // sem "compression_completed" para p1
  ];
  assert.equal(hasOrphanedStart(events), true);
});

test("hasOrphanedStart não confunde um upload_failed (fim legítimo) com órfão", () => {
  const events: DiagnosticEvent[] = [
    ev({ sessionId: "s1", kind: "upload_requested", correlationId: "p1", at: "2026-08-18T10:00:00.000Z" }),
    ev({ sessionId: "s1", kind: "upload_failed", correlationId: "p1", at: "2026-08-18T10:00:01.000Z", reason: "rede" }),
  ];
  assert.equal(hasOrphanedStart(events), false);
});

test("lastCompletedSessionSummary ignora a sessão atual e resume a anterior mais recente", () => {
  const events: DiagnosticEvent[] = [
    ev({ sessionId: "sessao-antiga", kind: "compression_started", correlationId: "p1", at: "2026-08-16T10:00:00.000Z" }),
    ev({ sessionId: "sessao-antiga", kind: "compression_completed", correlationId: "p1", at: "2026-08-16T10:00:01.000Z" }),
    ev({ sessionId: "sessao-anterior", kind: "compression_started", correlationId: "p2", at: "2026-08-17T10:00:00.000Z" }),
    ev({ sessionId: "sessao-anterior", kind: "compression_started", correlationId: "p3", at: "2026-08-17T10:00:01.000Z" }),
    ev({ sessionId: "sessao-anterior", kind: "compression_completed", correlationId: "p2", at: "2026-08-17T10:00:02.000Z" }),
    // p3 nunca conclui — a sessão anterior mostra 2 iniciadas, 1 concluída
    ev({ sessionId: "sessao-atual", kind: "compression_started", correlationId: "p4", at: "2026-08-18T10:00:00.000Z" }),
  ];
  assert.deepEqual(lastCompletedSessionSummary(events, "sessao-atual"), { started: 2, completed: 1 });
});

test("lastCompletedSessionSummary retorna null quando não há sessão anterior", () => {
  const events: DiagnosticEvent[] = [ev({ sessionId: "sessao-atual", kind: "compression_started", correlationId: "p1", at: "2026-08-18T10:00:00.000Z" })];
  assert.equal(lastCompletedSessionSummary(events, "sessao-atual"), null);
});

test("selectDiagnosticEventKeysToDiscard mantém a sessão atual e a última anterior, descarta sessões antigas sem pendência", () => {
  const antiga = [
    ev({ sessionId: "antiga", kind: "compression_started", correlationId: "p1", at: "2026-08-15T10:00:00.000Z" }),
    ev({ sessionId: "antiga", kind: "compression_completed", correlationId: "p1", at: "2026-08-15T10:00:01.000Z" }),
  ];
  const anterior = [ev({ sessionId: "anterior", kind: "compression_started", correlationId: "p2", at: "2026-08-17T10:00:00.000Z" })];
  const atual = [ev({ sessionId: "atual", kind: "compression_started", correlationId: "p3", at: "2026-08-18T10:00:00.000Z" })];
  const events = [...antiga, ...anterior, ...atual];

  const toDiscard = selectDiagnosticEventKeysToDiscard(events, "atual");

  assert.deepEqual(
    toDiscard.sort((a, b) => a - b),
    antiga.map((e) => e.key).sort((a, b) => (a as number) - (b as number)),
  );
});

test("selectDiagnosticEventKeysToDiscard preserva uma sessão antiga que tem início órfão, mesmo não sendo a mais recente", () => {
  const antigaComOrfao = [
    ev({ sessionId: "antiga-com-orfao", kind: "compression_started", correlationId: "p1", at: "2026-08-10T10:00:00.000Z" }),
    // sem "completed" — órfão de verdade, prova de queda numa sessão de dias atrás
  ];
  const anterior = [
    ev({ sessionId: "anterior", kind: "compression_started", correlationId: "p2", at: "2026-08-17T10:00:00.000Z" }),
    ev({ sessionId: "anterior", kind: "compression_completed", correlationId: "p2", at: "2026-08-17T10:00:01.000Z" }),
  ];
  const atual = [ev({ sessionId: "atual", kind: "compression_started", correlationId: "p3", at: "2026-08-18T10:00:00.000Z" })];
  const events = [...antigaComOrfao, ...anterior, ...atual];

  const toDiscard = selectDiagnosticEventKeysToDiscard(events, "atual");

  assert.equal(toDiscard.length, 0);
});
