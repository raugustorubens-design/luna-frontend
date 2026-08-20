"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getRonda, patchRonda, RondaSubmitError } from "@/lib/ronda/api-client";
import { deleteQueueItem, getQueueItem, updateQueueSubmission, type QueueStatus } from "@/lib/ronda/db";
import { trySyncPendingRondas } from "@/lib/ronda/queue";
import { duplicateFinding, findingsWithMissingFields, type RondaFinding, type RondaMetadata } from "@/lib/ronda/types";
import { ENTRY_STATUS_LABEL } from "@/lib/ronda/list-view";
import { mapIssuesToFindings, isOldFormatRejection, canDiscardInvalidItem, type ValidationIssue } from "@/lib/ronda/issues";
import { scrollToField } from "@/lib/ronda/field-anchor";
import { FindingCard } from "./finding-card";
import { MissingFieldsNotice } from "./missing-fields-notice";

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

  /**
   * Gate do cliente (Etapa 1) sobre o conteúdo já carregado — funciona
   * mesmo quando `queueIssues` é `undefined` (item caiu em "invalid" antes
   * desta correção existir, sem `issues` guardadas). Só quando ele não acha
   * nada de faltando é que a classificação recorre à heurística de
   * `isOldFormatRejection` sobre as issues do servidor, se houver.
   */
  const clientMissingFields = useMemo(() => findingsWithMissingFields(findings), [findings]);
  const { byFinding: issuesByFinding, unmapped: unmappedIssues } = useMemo(
    () => mapIssuesToFindings(queueIssues ?? [], new Set(findings.map((f) => f.id))),
    [queueIssues, findings],
  );
  const isOldFormat = clientMissingFields.length === 0 && isOldFormatRejection(queueIssues);
  /**
   * Achado 2 (revisão da branch): mais conservador que `isOldFormat`, de
   * propósito — ver a nota em `canDiscardInvalidItem`. Um payload misto
   * (issue de campo real + issue de `id`) pode continuar classificado como
   * "formato antigo" na mensagem e ainda assim não permitir "Descartar",
   * porque uma das issues aponta pra um campo de um achado que ainda está
   * na lista carregada.
   */
  const allowDiscardInvalid = queueStatus !== "invalid" || canDiscardInvalidItem(findings, queueIssues);
  const totalMissingFields = useMemo(() => clientMissingFields.reduce((sum, entry) => sum + entry.missing.length, 0), [clientMissingFields]);

  /**
   * Pacote "gate com link ao campo" — "Salvar e enviar" precisa do mesmo
   * gate que o wizard, com a mesma função (`findingsWithMissingFields`),
   * não uma cópia: sem isto, uma ronda recusada abre para correção, a
   * pessoa preenche parte, salva, volta para a fila e o servidor recusa de
   * novo pelo campo que continua vazio. Aplicado também no modo `server`
   * (não só `queue`): a mesma regra do backend vale para os dois — uma
   * edição de ronda já confirmada que zere um campo obrigatório quebraria
   * do mesmo jeito no próximo `PATCH`.
   */
  async function handleSave() {
    if (!metadata) return;
    if (totalMissingFields > 0) {
      const first = clientMissingFields[0];
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToField(first.finding.id, first.missing[0])));
      return;
    }
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
    return <p className="p-4 text-sm text-[#6B7C99] dark:text-[#5A6E8A]">Carregando…</p>;
  }

  return (
    <div className="ronda-shell flex flex-col overflow-hidden">
      <header className="ronda-chrome-top shrink-0 border-b border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-[#0A1B3D] dark:text-[#DCE6F2]">Editar LUNA Safety Walk</h1>
            <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              {metadata.titulo} — {metadata.local} — {metadata.data}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/ronda/historico")}
            className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-xs text-[#41557A] dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE]"
          >
            Voltar à lista
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">
          {isQueue ? `Ainda neste aparelho — ${ENTRY_STATUS_LABEL[queueStatus ?? "pending"]}` : ENTRY_STATUS_LABEL.server}
        </p>
      </header>

      <main className="ronda-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-3">
          {isQueue && queueStatus === "invalid" && (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-2.5 text-xs text-orange-800 dark:text-orange-300">
              <p className="font-medium">O servidor recusou esta ronda{queueError ? `: ${queueError}` : "."}</p>
              {isOldFormat ? (
                <p className="mt-1">Não dá para recuperar — formato antigo, sem os campos que esta tela edita. Refaça esta ronda pelo formulário e descarte este item da fila.</p>
              ) : (
                <p className="mt-1">Corrija os campos indicados abaixo e salve — ela volta pra fila e é reenviada.</p>
              )}
            </div>
          )}

          {isQueue && unmappedIssues.length > 0 && (
            <div className="rounded border border-orange-500/40 bg-orange-500/10 p-2.5 text-xs text-orange-800 dark:text-orange-300">
              <p className="font-medium">O servidor também apontou:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {unmappedIssues.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {findings.length === 0 && <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">Esta ronda não tem nenhum achado registrado.</p>}

          {clientMissingFields.length > 0 && <MissingFieldsNotice missingFieldsList={clientMissingFields} />}

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

          <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
            Observações gerais
            <textarea
              value={observacoesGerais}
              onChange={(event) => setObservacoesGerais(event.target.value)}
              rows={4}
              className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2]"
            />
          </label>

          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          {saved && (
            <p className="text-xs text-emerald-500">{isQueue ? "Salvo neste aparelho e recolocado na fila de envio." : "Alterações salvas."}</p>
          )}

          {/*
            Escondido quando há algo corrigível na tela — nem
            `findingsWithMissingFields` nem uma issue mapeada pra um achado
            carregado, ver `canDiscardInvalidItem`. Oferecer "descartar" pra
            uma ronda que só precisa de um campo preenchido seria oferecer
            perda de dado: as fotos de um achado só existem neste aparelho.
          */}
          {isQueue && allowDiscardInvalid && (
            <button type="button" onClick={() => void handleDiscard()} className="self-start text-xs text-red-500 underline dark:text-red-400">
              Descartar esta ronda do aparelho
            </button>
          )}
        </div>
      </main>

      <footer className="ronda-chrome-bottom shrink-0 border-t border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
        {/*
          Item 2 da fila (curadoria) — o botão não gera mais direto daqui:
          leva pra tela de curadoria primeiro (editar/excluir achado), que é
          quem gera de fato — inclusive a escolha de formato/orientação/
          papel (Etapa 1 de `2026-08-19-saida-formato-e-pagina.md`), que
          mora lá agora, não aqui. Regra do desenho ("a ronda não muda, o
          relatório carrega a versão curada") só é respeitada se gerar
          sempre passar por ali. Só em `source.kind === "server"`: uma ronda
          ainda na fila local não tem `rondaId` confirmado pelo servidor
          para gerar relatório a partir dele.
        */}
        {source.kind === "server" && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => router.push(`/ronda/historico/${source.rondaId}/curadoria`)}
              className="w-full rounded border border-[#003C90] px-4 py-2 text-sm font-medium text-[#003C90] transition-opacity dark:border-[#A0B8C8] dark:text-[#A0B8C8]"
            >
              Gerar relatório
            </button>
          </div>
        )}
        {/*
          `aria-disabled`, não `disabled`, quando falta campo — mesmo
          motivo do botão "Concluir" do wizard: em campo, o toque precisa
          virar resposta (rolar até o campo), não silêncio. `disabled` de
          verdade continua valendo enquanto a requisição está em voo
          (`saving`), onde não há nada útil a fazer com um segundo clique.
        */}
        <button
          type="button"
          disabled={saving}
          aria-disabled={totalMissingFields > 0}
          onClick={() => void handleSave()}
          className={`w-full rounded px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-40 ${
            totalMissingFields > 0 ? "bg-emerald-500/50" : "bg-emerald-500"
          }`}
        >
          {saving
            ? "Salvando…"
            : totalMissingFields > 0
              ? `Faltam ${totalMissingFields} campo${totalMissingFields === 1 ? "" : "s"}`
              : isQueue
                ? "Salvar e enviar"
                : "Salvar alterações"}
        </button>
      </footer>
    </div>
  );
}
