"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  emptyMetadata,
  emptyFindings,
  emptyClosing,
  metadataComplete,
  pendingFindings,
  findingsWithMissingFields,
  newFinding,
  duplicateFinding,
  diffSuggestionFields,
  FLAG_LABELS,
  type RondaMetadata,
  type RondaFinding,
  type RondaClosing,
  type RondaFlag,
  type RondaSuggestion,
  type SuggestionRecord,
} from "@/lib/ronda/types";
import { getFlags, getSugestoes, postCorrecaoSugestao, RondaSubmitError } from "@/lib/ronda/api-client";
import { enqueueRonda, loadDraft, saveDraft, clearDraft } from "@/lib/ronda/db";
import { promoteEmbeddedPhotos } from "@/lib/ronda/foto-upload";
import { scrollToField } from "@/lib/ronda/field-anchor";
import { useRondaQueue } from "@/lib/ronda/use-ronda-queue";
import { QueueStatusBar } from "./queue-status-bar";
import { FindingCard } from "./finding-card";
import { MissingFieldsNotice } from "./missing-fields-notice";
import { ThemeToggle } from "./theme-toggle";

type Step = "A" | "B" | "C" | "done";

/**
 * Etapa B (achado dinâmico — revisão de arquitetura, Decisões 1-3): a
 * pessoa marca quantos flags quiser (checkbox, não radio). Marcar um flag
 * de risco busca sugestões reais (`GET /convergia/ronda/sugestoes`) — cada
 * uma é só um botão "+ [texto]"; apertar cria um achado novo (sempre pelo
 * mesmo `FindingCard`, nunca um formulário diferente por origem). Flag sem
 * sugestão estruturada (`passivo_trabalhista`) mostra só um "+" manual.
 */
function FlagSection({
  flag,
  checked,
  onToggle,
  suggestions,
  onAddFromSuggestion,
  onAddManual,
}: {
  flag: RondaFlag;
  checked: boolean;
  onToggle: () => void;
  suggestions: RondaSuggestion[] | "loading" | undefined;
  onAddFromSuggestion: (suggestion: RondaSuggestion) => void;
  onAddManual: () => void;
}) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-[rgba(112,136,160,0.16)]">
      <label className="flex items-center gap-2 text-sm text-[#0A1B3D] dark:text-[#DCE6F2]">
        <input type="checkbox" checked={checked} onChange={onToggle} className="[color-scheme:light] dark:[color-scheme:dark]" />
        {FLAG_LABELS[flag.nome] ?? flag.nome}
      </label>

      {checked && (
        <div className="mt-2 flex flex-col gap-1.5 pl-6">
          {suggestions === "loading" && <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">Carregando sugestões…</p>}
          {Array.isArray(suggestions) &&
            suggestions.map((suggestion) => (
              <button
                key={suggestion.controleRiscoId}
                type="button"
                onClick={() => onAddFromSuggestion(suggestion)}
                className="rounded border border-dashed border-black/20 px-2 py-1.5 text-left text-xs text-[#41557A] hover:border-[#003C90] hover:text-[#003C90] dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE] dark:hover:border-[#A0B8C8] dark:hover:text-[#A0B8C8]"
              >
                + {suggestion.descricao}
              </button>
            ))}
          {Array.isArray(suggestions) && suggestions.length === 0 && (
            <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">Sem sugestão cadastrada — adicione manualmente.</p>
          )}
          <button
            type="button"
            onClick={onAddManual}
            className="rounded border border-black/15 px-2 py-1.5 text-left text-xs text-[#6B7C99] hover:border-[#003C90] hover:text-[#003C90] dark:border-[rgba(112,136,160,0.28)] dark:text-[#5A6E8A] dark:hover:border-[#A0B8C8] dark:hover:text-[#A0B8C8]"
          >
            + Adicionar achado manualmente para este flag
          </button>
        </div>
      )}
    </div>
  );
}

export function RondaWizard() {
  const { counts, syncNow, items: queueItems, discardInvalid } = useRondaQueue();
  const [step, setStep] = useState<Step>("A");
  const [metadata, setMetadata] = useState<RondaMetadata>(emptyMetadata);
  const [findings, setFindings] = useState<RondaFinding[]>(emptyFindings);
  const [closing, setClosing] = useState<RondaClosing>(emptyClosing);
  const [savedLocally, setSavedLocally] = useState(false);

  const [flags, setFlags] = useState<RondaFlag[]>([]);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [checkedFlags, setCheckedFlags] = useState<Set<string>>(new Set());
  const [suggestionsByFlag, setSuggestionsByFlag] = useState<Record<string, RondaSuggestion[] | "loading">>({});
  /** Sugestão original (flag ou foto/Fase 4) que pré-preencheu cada achado — Decisão 3, comparado contra o valor salvo na hora de concluir. */
  const [suggestionOrigins, setSuggestionOrigins] = useState<Record<string, SuggestionRecord>>({});

  /** `false` até a tentativa de recuperar o rascunho terminar — trava o autosave pra ele não gravar o estado inicial vazio por cima de um rascunho bom. */
  const [draftLoaded, setDraftLoaded] = useState(false);
  /** Houve rascunho recuperado nesta montagem — vira um aviso na tela, pra pessoa saber por que os campos já vieram preenchidos. */
  const [draftRecovered, setDraftRecovered] = useState(false);

  // Recupera a ronda em andamento (ver `saveDraft` em `lib/ronda/db.ts`).
  // Roda antes de qualquer digitação, na montagem — se a aba caiu no meio
  // da ronda, a pessoa volta exatamente na etapa onde estava, com os
  // achados e as fotos.
  useEffect(() => {
    let cancelled = false;
    void loadDraft()
      .then((draft) => {
        if (cancelled || !draft) return;
        setMetadata(draft.metadata);
        setFindings(draft.findings);
        setClosing(draft.closing);
        setCheckedFlags(new Set(draft.checkedFlags));
        setSuggestionOrigins(draft.suggestionOrigins);
        // `done` nunca deveria estar gravado (a conclusão apaga o rascunho),
        // mas um rascunho antigo/corrompido não pode devolver a pessoa a uma
        // tela de sucesso que não aconteceu.
        if (draft.step === "A" || draft.step === "B" || draft.step === "C") setStep(draft.step);
        setDraftRecovered(true);
      })
      .finally(() => {
        if (!cancelled) setDraftLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFlags()
      .then((result) => {
        if (!cancelled) setFlags(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setFlagsError(err instanceof RondaSubmitError ? err.message : "Falha ao carregar o catálogo de flags.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(() => pendingFindings(findings), [findings]);
  const missingFieldsList = useMemo(() => findingsWithMissingFields(findings), [findings]);
  const totalMissingFields = useMemo(() => missingFieldsList.reduce((sum, entry) => sum + entry.missing.length, 0), [missingFieldsList]);
  const canConclude = pending.length === 0 && missingFieldsList.length === 0;

  /**
   * `data` fica de fora de propósito: `emptyMetadata()` já nasce com a data
   * de hoje, então ela não distingue "ronda começada" de "tela recém-aberta"
   * — considerá-la faria toda visita gravar um rascunho vazio e, na visita
   * seguinte, anunciar uma recuperação que não recuperou nada.
   */
  const hasDraftContent = useMemo(
    () =>
      Boolean(metadata.titulo.trim() || metadata.local.trim() || metadata.responsavel.trim() || metadata.turno.trim()) ||
      findings.length > 0 ||
      checkedFlags.size > 0 ||
      Boolean(closing.observacoesGerais?.trim()),
    [metadata, findings, checkedFlags, closing],
  );

  // Autosave do rascunho. Debounce de 600ms porque a dependência inclui
  // `findings` — que muda a cada tecla digitada num campo de achado — e
  // gravar fotos em base64 no IndexedDB a cada tecla travaria a digitação
  // num celular de campo. Sem rascunho ainda em branco: se a pessoa
  // esvaziou tudo, o registro é apagado em vez de gravado vazio.
  useEffect(() => {
    if (!draftLoaded || step === "done") return;
    const timer = setTimeout(() => {
      if (!hasDraftContent) {
        void clearDraft();
        return;
      }
      void saveDraft({
        step,
        metadata,
        findings,
        closing,
        checkedFlags: Array.from(checkedFlags),
        suggestionOrigins,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [draftLoaded, hasDraftContent, step, metadata, findings, closing, checkedFlags, suggestionOrigins]);

  function updateFinding(next: RondaFinding) {
    setFindings((current) => current.map((f) => (f.id === next.id ? next : f)));
  }

  function addFinding(finding: RondaFinding) {
    setFindings((current) => [...current, finding]);
  }

  function removeFinding(findingId: string) {
    setFindings((current) => current.filter((f) => f.id !== findingId));
    // Descarta junto o registro de sugestão do achado removido, mesmo
    // princípio do `setEstado` em `FindingCard` (não guardar dado de um
    // achado que a pessoa decidiu não manter). O payload de correção em si
    // já estaria a salvo sem isto — `handleConclude` percorre `findings`,
    // não `suggestionOrigins`, então um achado fora da lista nunca é
    // enviado; a limpeza evita o registro órfão em memória.
    setSuggestionOrigins((current) => {
      if (!current[findingId]) return current;
      const next = { ...current };
      delete next[findingId];
      return next;
    });
  }

  /** Registra/funde o que uma sugestão pré-preencheu num achado — Decisão 3. Uma sugestão de foto que chega depois de uma de flag (ou vice-versa) funde os campos em vez de substituir o registro; `origem` mantém a primeira fonte que contribuiu. */
  function recordSuggestion(findingId: string, origem: SuggestionRecord["origem"], sugerido: SuggestionRecord["sugerido"], flagId?: string) {
    if (Object.keys(sugerido).length === 0) return;
    setSuggestionOrigins((current) => {
      const existing = current[findingId];
      if (existing) {
        return { ...current, [findingId]: { ...existing, sugerido: { ...existing.sugerido, ...sugerido } } };
      }
      return { ...current, [findingId]: { origem, flagId, sugerido } };
    });
  }

  function toggleFlag(flag: RondaFlag) {
    setCheckedFlags((current) => {
      const next = new Set(current);
      if (next.has(flag.nome)) {
        next.delete(flag.nome);
        return next;
      }
      next.add(flag.nome);
      return next;
    });

    if (checkedFlags.has(flag.nome) || flag.bibliotecaRiscoId === null) return;
    if (suggestionsByFlag[flag.nome]) return;

    setSuggestionsByFlag((current) => ({ ...current, [flag.nome]: "loading" }));
    getSugestoes(flag.nome)
      .then((sugestoes) => setSuggestionsByFlag((current) => ({ ...current, [flag.nome]: sugestoes })))
      .catch(() => setSuggestionsByFlag((current) => ({ ...current, [flag.nome]: [] })));
  }

  async function handleConclude() {
    if (!canConclude) return;
    // Camada 2: última tentativa de subir as fotos que ficaram no aparelho
    // (sem rede no momento do clique). Cada uma que sobe sai do payload do
    // relatório e sai do armazenamento local — e é o único caminho pelo qual
    // a original chega ao servidor. Nunca lança: falhar aqui só significa
    // que a ronda vai como sempre foi, com os bytes embutidos.
    const achados = await promoteEmbeddedPhotos(findings);
    if (achados !== findings) setFindings(achados);
    const item = await enqueueRonda({ metadata, achados, encerramento: closing });
    // A ronda virou item de fila — o rascunho já cumpriu o papel dele e
    // some, pra próxima abertura do app não oferecer "recuperar" uma ronda
    // que já foi concluída.
    void clearDraft();
    setDraftRecovered(false);
    setSavedLocally(true);
    void syncNow(); // tenta enviar imediatamente se houver rede; se não, fica na fila e o evento 'online' cuida do resto.
    setStep("done");

    // Decisão 3 (correção humana vira aprendizado) — best-effort, não
    // bloqueia a conclusão nem depende da ronda já ter sincronizado com o
    // servidor (`item.localId` identifica a ronda mesmo offline;
    // `postCorrecaoSugestao` nunca lança, falha some em silêncio).
    for (const finding of achados) {
      const record = suggestionOrigins[finding.id];
      if (!record) continue;
      const camposCorrigidos = diffSuggestionFields(record, finding);
      if (Object.keys(camposCorrigidos).length === 0) continue;
      void postCorrecaoSugestao({
        rondaId: item.localId,
        achadoId: finding.id,
        origem: record.origem,
        flagId: record.flagId,
        camposCorrigidos,
      });
    }
  }

  function startNewRonda() {
    setMetadata(emptyMetadata());
    setFindings(emptyFindings());
    setClosing(emptyClosing());
    setCheckedFlags(new Set());
    setSuggestionsByFlag({});
    setSuggestionOrigins({});
    setSavedLocally(false);
    setDraftRecovered(false);
    void clearDraft();
    setStep("A");
  }

  return (
    <div className="ronda-shell flex flex-col overflow-hidden">
      <div className="ronda-chrome-top shrink-0">
        <QueueStatusBar
          counts={counts}
          onSyncNow={() => void syncNow()}
          invalidItems={queueItems.filter((item) => item.status === "invalid")}
          onDiscardInvalid={(localId) => void discardInvalid(localId)}
        />

        <header className="flex items-start justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
          <div>
            <h1 className="text-base font-semibold text-[#0A1B3D] dark:text-[#DCE6F2]">LUNA Safety Walk</h1>
            <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              {step === "A" && "Etapa 1 de 3 — Dados do LUNA Safety Walk"}
              {step === "B" && "Etapa 2 de 3 — Flags de risco e achados"}
              {step === "C" && "Etapa 3 de 3 — Encerramento"}
              {step === "done" && "LUNA Safety Walk registrado"}
            </p>
          </div>
          <ThemeToggle />
        </header>
      </div>

      {/* `min-h-0` é o que transforma o `flex-1` numa altura de verdade:
          sem ele, o `min-height: auto` que o flex dá de padrão ao filho
          deixa a `<main>` crescer junto com o conteúdo, e o
          `overflow-y-auto` nunca chega a valer — quem rolava era o
          documento inteiro, levando cabeçalho e rodapé embora. */}
      <main className="ronda-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {draftRecovered && step !== "done" && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded border border-[#003C90]/40 dark:border-[#A0B8C8]/40 bg-[#003C90]/10 dark:bg-[#A0B8C8]/10 p-2.5 text-xs text-[#003C90] dark:text-[#A0B8C8]">
            {/*
              Antes esta mensagem afirmava "nada do que você já tinha
              preenchido se perdeu" — e é exatamente quando uma foto se perde
              (app derrubado no meio da captura/compressão, antes do autosave
              seguinte gravar o rascunho) que esta tela aparece. O rascunho
              recupera o que já tinha sido salvo até o último autosave — não
              tem como saber, hoje, se havia uma foto em processamento no
              instante da queda (esse rastro é o que a instrumentação de
              IndexedDB de uma etapa futura vai deixar). Até lá, a mensagem
              não promete o que não sabe: pede pra conferir foto por foto.
            */}
            <p>
              Ronda em andamento recuperada deste aparelho, com os dados até o último salvamento automático.
              Confira as fotos de cada achado — uma foto sendo processada no momento em que o app fechou
              pode não ter sido salva.
              <button type="button" onClick={startNewRonda} className="ml-2 underline">
                Começar do zero
              </button>
            </p>
            <button type="button" onClick={() => setDraftRecovered(false)} className="shrink-0 underline" aria-label="Dispensar aviso">
              ok
            </button>
          </div>
        )}

        {step === "A" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Título
              <input
                type="text"
                value={metadata.titulo}
                onChange={(event) => setMetadata({ ...metadata, titulo: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] [color-scheme:light] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
                placeholder="ex. LUNA Safety Walk — Turno A"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Data
              <input
                type="date"
                value={metadata.data}
                onChange={(event) => setMetadata({ ...metadata, data: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] [color-scheme:light] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Local / Planta
              <input
                type="text"
                value={metadata.local}
                onChange={(event) => setMetadata({ ...metadata, local: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] [color-scheme:light] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
                placeholder="ex. Unidade Sylvamo/Mogi Guaçu"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Responsável
              <input
                type="text"
                value={metadata.responsavel}
                onChange={(event) => setMetadata({ ...metadata, responsavel: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] [color-scheme:light] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Turno
              <input
                type="text"
                value={metadata.turno}
                onChange={(event) => setMetadata({ ...metadata, turno: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] [color-scheme:light] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:dark]"
                placeholder="ex. manhã, tarde, noite"
              />
            </label>
            <Link href="/ronda/historico" className="mt-1 text-xs text-[#003C90] underline dark:text-[#A0B8C8]">
              Ver rondas anteriores
            </Link>
          </div>
        )}

        {step === "B" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-[#6B7C99] dark:text-[#5A6E8A]">Flags</h2>
              {flagsError && <p className="text-xs text-red-400">{flagsError}</p>}
              {flags.map((flag) => (
                <FlagSection
                  key={flag.nome}
                  flag={flag}
                  checked={checkedFlags.has(flag.nome)}
                  onToggle={() => toggleFlag(flag)}
                  suggestions={suggestionsByFlag[flag.nome]}
                  onAddFromSuggestion={(suggestion) => {
                    const finding = newFinding(flag.nome, { descricao: suggestion.descricao });
                    addFinding(finding);
                    recordSuggestion(finding.id, "flag", { descricao: suggestion.descricao }, flag.nome);
                  }}
                  onAddManual={() => addFinding(newFinding(flag.nome))}
                />
              ))}
              <button
                type="button"
                onClick={() => addFinding(newFinding(null))}
                className="self-start rounded border border-black/15 px-3 py-1.5 text-xs text-[#41557A] hover:border-[#003C90] hover:text-[#003C90] dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE] dark:hover:border-[#A0B8C8] dark:hover:text-[#A0B8C8]"
              >
                + Achado avulso (sem flag)
              </button>
            </div>

            {findings.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-[rgba(112,136,160,0.16)]">
                <h2 className="text-xs font-medium uppercase tracking-wide text-[#6B7C99] dark:text-[#5A6E8A]">Achados ({findings.length})</h2>
                {findings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onChange={updateFinding}
                    onDuplicate={(f) => addFinding(duplicateFinding(f))}
                    onRemove={removeFinding}
                    onSuggestionApplied={(findingId, sugerido) => recordSuggestion(findingId, "foto", sugerido)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {step === "C" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
              Observações gerais (opcional)
              <textarea
                value={closing.observacoesGerais ?? ""}
                onChange={(event) => setClosing({ ...closing, observacoesGerais: event.target.value })}
                rows={4}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-[#0A1B3D] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[#41557A] dark:text-[#7E92AE]">
              <input
                type="checkbox"
                checked={closing.incluirGraficoResumo}
                onChange={(event) => setClosing({ ...closing, incluirGraficoResumo: event.target.checked })}
                className="[color-scheme:light] dark:[color-scheme:dark]"
              />
              Incluir gráfico-resumo no relatório
            </label>

            {pending.length > 0 && (
              <div className="rounded border border-amber-400/40 bg-amber-400/40 p-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-300">
                <p className="font-medium">Ainda há {pending.length} achado(s) marcado(s) como &quot;não avaliado&quot; — revise antes de concluir.</p>
              </div>
            )}
            {missingFieldsList.length > 0 && <MissingFieldsNotice missingFieldsList={missingFieldsList} onNavigate={() => setStep("B")} />}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-[#1E3A61] dark:text-[#A8BBD4]">
              {savedLocally ? "LUNA Safety Walk salvo neste dispositivo." : "LUNA Safety Walk registrado."}
              <br />
              {counts.pending > 0 ? "Enviando ao servidor assim que houver rede — acompanhe na barra acima." : "Já confirmado no servidor."}
            </p>
            <button type="button" onClick={startNewRonda} className="mt-2 rounded bg-[#003C90] dark:bg-[#A0B8C8] px-4 py-2 text-sm font-medium text-white dark:text-[#000206]">
              Novo LUNA Safety Walk
            </button>
          </div>
        )}
      </main>

      {step !== "done" && (
        <footer className="ronda-chrome-bottom flex shrink-0 items-center justify-between gap-2 border-t border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
          <button
            type="button"
            disabled={step === "A"}
            onClick={() => setStep(step === "C" ? "B" : "A")}
            className="rounded border border-black/15 px-4 py-2 text-sm text-[#41557A] disabled:opacity-30 dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE]"
          >
            Voltar
          </button>
          {step === "A" && (
            <button
              type="button"
              disabled={!metadataComplete(metadata)}
              onClick={() => setStep("B")}
              className="rounded bg-[#003C90] dark:bg-[#A0B8C8] px-4 py-2 text-sm font-medium text-white dark:text-[#000206] disabled:opacity-40"
            >
              Avançar
            </button>
          )}
          {step === "B" && (
            <button type="button" onClick={() => setStep("C")} className="rounded bg-[#003C90] dark:bg-[#A0B8C8] px-4 py-2 text-sm font-medium text-white dark:text-[#000206]">
              Avançar
            </button>
          )}
          {step === "C" && (
            <button
              type="button"
              aria-disabled={!canConclude}
              onClick={() => {
                if (!canConclude) {
                  // `aria-disabled`, não `disabled`: em campo, com luva, um
                  // botão morto não explica nada — o toque vira a resposta.
                  // Prioriza campo faltando (tem alvo pra rolar); "não
                  // avaliado" sozinho só leva de volta pra Etapa B, sem
                  // achado específico pra focar (fora do escopo deste gate).
                  const first = missingFieldsList[0];
                  setStep("B");
                  if (first) {
                    requestAnimationFrame(() => requestAnimationFrame(() => scrollToField(first.finding.id, first.missing[0])));
                  }
                  return;
                }
                void handleConclude();
              }}
              className={`rounded px-4 py-2 text-sm font-medium text-black transition-opacity ${canConclude ? "bg-emerald-500" : "bg-emerald-500/50"}`}
            >
              {canConclude ? "Concluir LUNA Safety Walk" : totalMissingFields > 0 ? `Faltam ${totalMissingFields} campo${totalMissingFields === 1 ? "" : "s"}` : "Avalie os achados pendentes"}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
