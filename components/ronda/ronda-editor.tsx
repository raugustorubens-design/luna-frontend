"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRonda, patchRonda, RondaSubmitError } from "@/lib/ronda/api-client";
import { deleteQueueItem, getQueueItem, updateQueueSubmission, type QueueStatus } from "@/lib/ronda/db";
import { trySyncPendingRondas } from "@/lib/ronda/queue";
import { duplicateFinding, findingsWithMissingFields, type MissingField, type RondaFinding, type RondaMetadata, type ValidationIssue } from "@/lib/ronda/types";
import { ENTRY_STATUS_LABEL } from "@/lib/ronda/list-view";
import { classifyQueueRejection, parseIssuePath } from "@/lib/ronda/issues";
import { FindingCard } from "./finding-card";

/**
 * Separa as issues do 422 em "por achado" (viram destaque de campo no
 * `FindingCard` correspondente) e "sem achado" (metadados, `id` que não bate
 * com nenhum achado carregado — mostradas à parte, com o texto do servidor,
 * nunca só uma contagem). Pura, exportada só para teste; não depende de
 * estado do componente além do que recebe por parâmetro.
 */
function splitIssues(
  issues: ValidationIssue[] | undefined,
  findingIds: ReadonlySet<string>,
): { byFinding: Record<string, Partial<Record<MissingField, string>>>; unmapped: ValidationIssue[] } {
  const byFinding: Record<string, Partial<Record<MissingField, string>>> = {};
  const unmapped: ValidationIssue[] = [];
  for (const issue of issues ?? []) {
    const parsed = parseIssuePath(issue.path);
    if (parsed && findingIds.has(parsed.findingId)) {
      (byFinding[parsed.findingId] ??= {})[parsed.field] = issue.message;
    } else {
      unmapped.push(issue);
    }
  }
  return { byFinding, unmapped };
}

/**
 * Edição de uma ronda, das duas origens que a lista agora mostra:
 *
 * - `server` — ronda já confirmada (`GET`/`PATCH /convergia/ronda/:id`,
 *   extensão da Fase 1, CONV-013);
 * - `queue`  — ronda que ainda está neste aparelho, em qualquer estado da
 *   fila offline (achado de campo 16/08/2026: uma ronda que não subiu era
 *   invisível e inalcançável, ver `lib/ronda/list-view.ts`).
 *
 * Reaproveita `FindingCard`, o mesmo componente de achado do wizard —
 * nenhuma UI nova de achado só para edição. Excluir a ronda do servidor não
 * faz parte desta tela (decisão destrutiva separada, fora de escopo);
 * descartar um item da fila local, sim — esse registro só existe aqui e
 * ficar preso sem saída foi justamente o problema que originou a tela.
 */
type EditorSource = { kind: "server"; rondaId: string } | { kind: "queue"; localId: string };

export function RondaEditor({ rondaId }: { rondaId: string }) {
  return <Editor source={{ kind: "server", rondaId }} />;
}

export function RondaQueueEditor({ localId }: { localId: string }) {
  return <Editor source={{ kind: "queue", localId }} />;
}

function Editor({ source }: { source: EditorSource }) {
  const router = useRouter();
  const [metadata, setMetadata] = useState<RondaMetadata | null>(null);
  const [findings, setFindings] = useState<RondaFinding[]>([]);
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [incluirGraficoResumo, setIncluirGraficoResumo] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [queueError, setQueueError] = useState<string | undefined>(undefined);
  const [queueIssues, setQueueIssues] = useState<ValidationIssue[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isQueue = source.kind === "queue";

  // Gate divergente de 17/08/2026 (Etapa 2). `byFinding` alimenta o
  // `serverIssues` de cada `FindingCard`; `unmapped` é o que não bate com
  // nenhum achado carregado (metadados, id que já não existe) — mostrado à
  // parte, texto do servidor, nunca só uma contagem.
  const { byFinding: issuesByFinding, unmapped: unmappedIssues } = useMemo(
    () => splitIssues(queueIssues, new Set(findings.map((f) => f.id))),
    [queueIssues, findings],
  );

  /**
   * Etapa 3 — qual das duas mensagens mostrar. Com `issues` guardadas
   * (rejeição depois desta correção), a classificação vem delas direto. Sem
   * `issues` (Etapa 4, item que já estava preso antes desta mudança), cai
   * pro gate do cliente: se há achado com campo obrigatório vazio agora, dá
   * pra corrigir na tela mesmo sem o servidor ter dito o quê — é essa rede
   * de segurança que resolve o caso preso sem esperar reenvio nenhum.
   */
  const recoverable = useMemo(() => {
    if (queueIssues && queueIssues.length > 0) return classifyQueueRejection(queueIssues) === "recoverable";
    return findingsWithMissingFields(findings).length > 0;
  }, [queueIssues, findings]);

  const load = useCallback(async () => {
    if (source.kind === "server") {
      const detail = await getRonda(source.rondaId);
      setMetadata(detail.metadata);
      setFindings(detail.achados);
      setObservacoesGerais(detail.encerramento.observacoesGerais ?? "");
      setIncluirGraficoResumo(detail.encerramento.incluirGraficoResumo);
      return;
    }
    const item = await getQueueItem(source.localId);
    if (!item) throw new RondaSubmitError("Esta ronda não está mais neste aparelho — provavelmente já foi enviada e confirmada.");
    setMetadata(item.submission.metadata);
    setFindings(item.submission.achados);
    setObservacoesGerais(item.submission.encerramento.observacoesGerais ?? "");
    setIncluirGraficoResumo(item.submission.encerramento.incluirGraficoResumo);
    setQueueStatus(item.status);
    setQueueError(item.lastError);
    setQueueIssues(item.issues);
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (cancelled) return;
      setLoadError(err instanceof RondaSubmitError ? err.message : "Falha ao carregar a ronda.");
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  function updateFinding(next: RondaFinding) {
    setFindings((current) => current.map((f) => (f.id === next.id ? next : f)));
  }

  async function handleSave() {
    if (!metadata) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      if (source.kind === "server") {
        await patchRonda(source.rondaId, { achados: findings, encerramento: { observacoesGerais } });
      } else {
        await updateQueueSubmission(source.localId, {
          metadata,
          achados: findings,
          encerramento: { observacoesGerais, incluirGraficoResumo },
        });
        setQueueStatus("pending");
        setQueueError(undefined);
        setQueueIssues(undefined);
        // Salvar aqui devolveu o item pra fila; tentar enviar na sequência é
        // o que fecha o ciclo — sem isto, a pessoa corrige uma ronda
        // rejeitada e ela fica parada até o próximo evento de rede.
        void trySyncPendingRondas();
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof RondaSubmitError ? err.message : "Falha ao salvar a edição.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDiscard() {
    if (source.kind !== "queue") return;
    if (!window.confirm("Descartar esta ronda deste aparelho? Ela ainda não foi enviada, então não há como recuperá-la depois.")) return;
    await deleteQueueItem(source.localId);
    router.push("/ronda/historico");
  }

  if (loadError) {
    return <p className="p-4 text-sm text-red-400">{loadError}</p>;
  }

  if (!metadata) {
    return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Carregando…</p>;
  }

  return (
    <div className="ronda-shell flex flex-col overflow-hidden">
      <header className="ronda-chrome-top shrink-0 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Editar LUNA Safety Walk</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {metadata.titulo} — {metadata.local} — {metadata.data}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ronda/historico")}
            className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-xs text-slate-700 dark:border-white/15 dark:text-slate-300"
          >
            Voltar à lista
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          {isQueue ? `Ainda neste aparelho — ${ENTRY_STATUS_LABEL[queueStatus ?? "pending"]}` : ENTRY_STATUS_LABEL.server}
        </p>
      </header>

      <main className="ronda-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-3">
          {/*
            Gate divergente de 17/08/2026 (Etapa 3). `queueError` (`lastError`)
            já é a mensagem definitiva quando `queueIssues` existe: `queue.ts`
            monta esse texto escolhendo a variante certa (recuperável ou não)
            na hora da rejeição — não há nada a acrescentar, e acrescentar
            duplicaria a instrução.

            A instrução extra abaixo só aparece na ausência de `queueIssues`
            — Etapa 4, rede de segurança para um item que ficou "invalid"
            *antes* desta correção existir: `lastError` daquele registro
            ainda carrega o texto antigo contraditório ("refaça e descarte"
            preso ao lado do que deveria dizer "corrija"), e o gate do
            cliente (Etapa 1, `recoverable` computado sobre os achados já
            carregados) é quem sabe que dá para corrigir mesmo sem o
            servidor ter confirmado de novo.
          */}
          {isQueue && queueError && (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-2.5 text-xs text-orange-800 dark:text-orange-300">
              <p className="font-medium">O servidor recusou esta ronda:</p>
              <p className="mt-1">{queueError}</p>
              {recoverable && (!queueIssues || queueIssues.length === 0) && (
                <p className="mt-1 font-medium">Corrija os campos indicados abaixo e salve — ela volta pra fila e é reenviada.</p>
              )}
            </div>
          )}

          {unmappedIssues.length > 0 && (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-2.5 text-xs text-orange-800 dark:text-orange-300">
              <p className="font-medium">Outros problemas apontados pelo servidor:</p>
              <ul className="mt-1 list-disc pl-4">
                {unmappedIssues.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>
                    {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {findings.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">Esta ronda não tem nenhum achado registrado.</p>}

          {/*
            `onRemove` só existe no modo `queue`, e a diferença não é
            arbitrária. `PATCH /convergia/ronda/:id` faz **upsert por `id`**
            (`luna-core`, `src/convergia/ronda/ronda-store.ts`): `id`
            conhecido substitui aquele achado, `id` novo entra na lista — não
            existe forma de o patch dizer "este achado saiu". Um "×" no modo
            `server` removeria o card, salvaria com sucesso e o achado
            voltaria no próximo carregamento: falha silenciosa. No modo
            `queue` o registro é local e é substituído inteiro, então remover
            funciona de verdade. Habilitar remoção no servidor depende de o
            contrato ganhar semântica de remoção em `luna-core` primeiro, o
            que é decisão do Architect, não ajuste de frontend.
          */}
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onChange={updateFinding}
              onDuplicate={(f) => setFindings((current) => [...current, duplicateFinding(f)])}
              onRemove={isQueue ? (findingId) => setFindings((current) => current.filter((f) => f.id !== findingId)) : undefined}
              serverIssues={issuesByFinding[finding.id]}
            />
          ))}

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Observações gerais
            <textarea
              value={observacoesGerais}
              onChange={(event) => setObservacoesGerais(event.target.value)}
              rows={4}
              className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 dark:border-white/15 dark:text-slate-100"
            />
          </label>

          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          {saved && (
            <p className="text-xs text-emerald-500">{isQueue ? "Salvo neste aparelho e recolocado na fila de envio." : "Alterações salvas."}</p>
          )}

          {/*
            Etapa 3: escondido especificamente quando o item está "invalid" e
            é recuperável — oferecer descartar aqui é oferecer perda de dado
            (as fotos daquele achado só existem neste aparelho) para um caso
            que a própria tela já sabe corrigir. Nos demais estados da fila
            (pending/error/syncing), descartar continua uma ação normal,
            sempre disponível.
          */}
          {isQueue && !(queueStatus === "invalid" && recoverable) && (
            <button type="button" onClick={() => void handleDiscard()} className="self-start text-xs text-red-500 underline dark:text-red-400">
              Descartar esta ronda do aparelho
            </button>
          )}
        </div>
      </main>

      <footer className="ronda-chrome-bottom shrink-0 border-t border-black/10 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {saving ? "Salvando…" : isQueue ? "Salvar e enviar" : "Salvar alterações"}
        </button>
      </footer>
    </div>
  );
}
