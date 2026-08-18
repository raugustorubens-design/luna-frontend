/**
 * Instrumentação mínima do pipeline de foto (comprimir, subir, sugerir) —
 * PR 3 de "Fechar a câmera". O defeito que motivou isto não deixava
 * nenhum rastro: a aba é descartada em pleno voo, a Promise nunca resolve
 * nem rejeita porque a aba já não existe. Sem erro na tela, sem falha de
 * rede, sem nada em log de servidor — foi o que levou uma investigação
 * inteira ao lugar errado antes de o bug real (`compressPhoto` decodificando
 * em resolução plena) ser encontrado.
 *
 * Grava em IndexedDB, não em console — o console morre junto com a aba. Um
 * "started"/"requested" sem o "completed"/"failed" correspondente,
 * encontrado na sessão seguinte, é a prova do descarte: o único jeito de
 * distinguir "o app morreu" de "não havia nada a dizer" (ex. sugestão sem
 * conteúdo é um "answered" normal, não uma falha).
 */
import { addDiagnosticEvent, deleteDiagnosticEvents, listDiagnosticEvents, newLocalId, type DiagnosticEvent, type DiagnosticEventKind } from "./db";

/** Uma por abertura do app — todo evento desta sessão carrega o mesmo valor. */
const SESSION_ID = newLocalId();

/** Id de correlação para compressão/upload de uma foto — o mesmo do início ao fim de uma mesma operação. */
export function newPhotoId(): string {
  return newLocalId();
}

function log(kind: DiagnosticEventKind, correlationId: string, extra: Partial<DiagnosticEvent> = {}): Promise<void> {
  return addDiagnosticEvent({ sessionId: SESSION_ID, kind, correlationId, at: new Date().toISOString(), ...extra });
}

export const logCompressionStarted = (photoId: string, inputSizeBytes: number, inputDims: { width: number; height: number } | null): Promise<void> =>
  log("compression_started", photoId, { inputSizeBytes, inputWidth: inputDims?.width ?? null, inputHeight: inputDims?.height ?? null });

export const logCompressionCompleted = (photoId: string, outputSizeBytes: number, outputWidth: number, outputHeight: number, durationMs: number): Promise<void> =>
  log("compression_completed", photoId, { outputSizeBytes, outputWidth, outputHeight, durationMs });

export const logUploadRequested = (photoId: string, sizeBytes: number): Promise<void> => log("upload_requested", photoId, { sizeBytes });
export const logUploadCompleted = (photoId: string): Promise<void> => log("upload_completed", photoId);
export const logUploadFailed = (photoId: string, reason: string): Promise<void> => log("upload_failed", photoId, { reason });

export const logSuggestionRequested = (achadoId: string): Promise<void> => log("suggestion_requested", achadoId);
export const logSuggestionAnswered = (achadoId: string): Promise<void> => log("suggestion_answered", achadoId);
export const logSuggestionFailed = (achadoId: string, reason: string): Promise<void> => log("suggestion_failed", achadoId, { reason });

/** Que "fim" fecha qual "início" — a base da detecção de órfão e da limpeza. */
const PAIR_ENDS: Partial<Record<DiagnosticEventKind, DiagnosticEventKind[]>> = {
  compression_started: ["compression_completed"],
  upload_requested: ["upload_completed", "upload_failed"],
  suggestion_requested: ["suggestion_answered", "suggestion_failed"],
};

/**
 * Verdadeiro se algum "início" não tem o "fim" correspondente pelo mesmo
 * `correlationId` — a assinatura de uma aba descartada no meio. Puro,
 * testável sem IndexedDB.
 */
export function hasOrphanedStart(events: DiagnosticEvent[]): boolean {
  for (const [startKind, endKinds] of Object.entries(PAIR_ENDS) as [DiagnosticEventKind, DiagnosticEventKind[]][]) {
    for (const start of events.filter((e) => e.kind === startKind)) {
      const closed = events.some((e) => endKinds.includes(e.kind) && e.correlationId === start.correlationId);
      if (!closed) return true;
    }
  }
  return false;
}

/** Compressões iniciadas vs. concluídas — a linha discreta da tela de rondas anteriores. Puro. */
export function summarizeCompressions(events: DiagnosticEvent[]): { started: number; completed: number } {
  return {
    started: events.filter((e) => e.kind === "compression_started").length,
    completed: events.filter((e) => e.kind === "compression_completed").length,
  };
}

function groupBySession(events: DiagnosticEvent[]): Map<string, DiagnosticEvent[]> {
  const map = new Map<string, DiagnosticEvent[]>();
  for (const event of events) {
    const list = map.get(event.sessionId);
    if (list) list.push(event);
    else map.set(event.sessionId, [event]);
  }
  return map;
}

function previousSessionsByRecency(events: DiagnosticEvent[], currentSessionId: string): { id: string; events: DiagnosticEvent[] }[] {
  return [...groupBySession(events).entries()]
    .filter(([id]) => id !== currentSessionId)
    .map(([id, evs]) => ({ id, events: evs, lastAt: Math.max(...evs.map((e) => new Date(e.at).getTime())) }))
    .sort((a, b) => b.lastAt - a.lastAt);
}

/**
 * Resumo da sessão anterior mais recente (não a atual — ela ainda está em
 * andamento, contar agora seria enganoso). `null` se esta é a primeira
 * sessão de todas. Puro.
 */
export function lastCompletedSessionSummary(events: DiagnosticEvent[], currentSessionId: string): { started: number; completed: number } | null {
  const previous = previousSessionsByRecency(events, currentSessionId);
  return previous.length > 0 ? summarizeCompressions(previous[0].events) : null;
}

/**
 * Quais eventos descartar: mantém a sessão atual (sempre), a última sessão
 * anterior (é ela que a tela mostra) e qualquer sessão com início órfão — a
 * evidência em si não pode ser descartada. O resto é diagnóstico que já
 * cumpriu o papel; guardar para sempre era o mesmo erro já corrigido uma
 * vez nas fotos originais (`discardRondaLocalCopies`, `db.ts`). Puro.
 */
export function selectDiagnosticEventKeysToDiscard(events: DiagnosticEvent[], currentSessionId: string): number[] {
  const previous = previousSessionsByRecency(events, currentSessionId);
  const keepSessions = new Set<string>([currentSessionId]);
  if (previous[0]) keepSessions.add(previous[0].id);
  for (const session of previous) {
    if (hasOrphanedStart(session.events)) keepSessions.add(session.id);
  }
  return events.filter((e) => !keepSessions.has(e.sessionId) && e.key !== undefined).map((e) => e.key as number);
}

/**
 * Lê tudo, calcula o resumo da última sessão anterior e descarta o que já
 * não tem valor diagnóstico — chamada uma vez ao abrir "rondas anteriores".
 */
export async function getLastSessionSummaryAndCleanup(): Promise<{ started: number; completed: number } | null> {
  const events = await listDiagnosticEvents();
  const summary = lastCompletedSessionSummary(events, SESSION_ID);
  const keysToDiscard = selectDiagnosticEventKeysToDiscard(events, SESSION_ID);
  if (keysToDiscard.length > 0) await deleteDiagnosticEvents(keysToDiscard);
  return summary;
}
