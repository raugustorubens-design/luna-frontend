"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  emptyMetadata,
  emptyFindings,
  emptyClosing,
  metadataComplete,
  pendingFindings,
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
import { enqueueRonda } from "@/lib/ronda/db";
import { useRondaQueue } from "@/lib/ronda/use-ronda-queue";
import { QueueStatusBar } from "./queue-status-bar";
import { FindingCard } from "./finding-card";
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
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <label className="flex items-center gap-2 text-sm text-slate-900 dark:text-slate-100">
        <input type="checkbox" checked={checked} onChange={onToggle} className="[color-scheme:light] dark:[color-scheme:dark]" />
        {FLAG_LABELS[flag.nome] ?? flag.nome}
      </label>

      {checked && (
        <div className="mt-2 flex flex-col gap-1.5 pl-6">
          {suggestions === "loading" && <p className="text-xs text-slate-500 dark:text-slate-400">Carregando sugestões…</p>}
          {Array.isArray(suggestions) &&
            suggestions.map((suggestion) => (
              <button
                key={suggestion.controleRiscoId}
                type="button"
                onClick={() => onAddFromSuggestion(suggestion)}
                className="rounded border border-dashed border-black/20 px-2 py-1.5 text-left text-xs text-slate-700 hover:border-cyan-500 hover:text-cyan-700 dark:border-white/20 dark:text-slate-300 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
              >
                + {suggestion.descricao}
              </button>
            ))}
          {Array.isArray(suggestions) && suggestions.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">Sem sugestão cadastrada — adicione manualmente.</p>
          )}
          <button
            type="button"
            onClick={onAddManual}
            className="rounded border border-black/15 px-2 py-1.5 text-left text-xs text-slate-600 hover:border-cyan-500 hover:text-cyan-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
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
  const canConclude = pending.length === 0;

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
    const item = await enqueueRonda({ metadata, achados: findings, encerramento: closing });
    setSavedLocally(true);
    void syncNow(); // tenta enviar imediatamente se houver rede; se não, fica na fila e o evento 'online' cuida do resto.
    setStep("done");

    // Decisão 3 (correção humana vira aprendizado) — best-effort, não
    // bloqueia a conclusão nem depende da ronda já ter sincronizado com o
    // servidor (`item.localId` identifica a ronda mesmo offline;
    // `postCorrecaoSugestao` nunca lança, falha some em silêncio).
    for (const finding of findings) {
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
    setStep("A");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <QueueStatusBar
        counts={counts}
        onSyncNow={() => void syncNow()}
        invalidItems={queueItems.filter((item) => item.status === "invalid")}
        onDiscardInvalid={(localId) => void discardInvalid(localId)}
      />

      <header className="flex items-start justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">LUNA Safety Walk</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {step === "A" && "Etapa 1 de 3 — Dados do LUNA Safety Walk"}
            {step === "B" && "Etapa 2 de 3 — Flags de risco e achados"}
            {step === "C" && "Etapa 3 de 3 — Encerramento"}
            {step === "done" && "LUNA Safety Walk registrado"}
          </p>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {step === "A" && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Título
              <input
                type="text"
                value={metadata.titulo}
                onChange={(event) => setMetadata({ ...metadata, titulo: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
                placeholder="ex. LUNA Safety Walk — Turno A"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Data
              <input
                type="date"
                value={metadata.data}
                onChange={(event) => setMetadata({ ...metadata, data: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Local / Planta
              <input
                type="text"
                value={metadata.local}
                onChange={(event) => setMetadata({ ...metadata, local: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
                placeholder="ex. Unidade Sylvamo/Mogi Guaçu"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Responsável
              <input
                type="text"
                value={metadata.responsavel}
                onChange={(event) => setMetadata({ ...metadata, responsavel: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Turno
              <input
                type="text"
                value={metadata.turno}
                onChange={(event) => setMetadata({ ...metadata, turno: event.target.value })}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
                placeholder="ex. manhã, tarde, noite"
              />
            </label>
            <Link href="/ronda/historico" className="mt-1 text-xs text-cyan-600 underline dark:text-cyan-400">
              Ver rondas anteriores
            </Link>
          </div>
        )}

        {step === "B" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Flags</h2>
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
                className="self-start rounded border border-black/15 px-3 py-1.5 text-xs text-slate-700 hover:border-cyan-500 hover:text-cyan-600 dark:border-white/15 dark:text-slate-300 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
              >
                + Achado avulso (sem flag)
              </button>
            </div>

            {findings.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
                <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Achados ({findings.length})</h2>
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
            <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
              Observações gerais (opcional)
              <textarea
                value={closing.observacoesGerais ?? ""}
                onChange={(event) => setClosing({ ...closing, observacoesGerais: event.target.value })}
                rows={4}
                className="rounded border border-black/15 bg-transparent px-2 py-2 text-sm text-slate-900 dark:border-white/15 dark:text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={closing.incluirGraficoResumo}
                onChange={(event) => setClosing({ ...closing, incluirGraficoResumo: event.target.checked })}
                className="[color-scheme:light] dark:[color-scheme:dark]"
              />
              Incluir gráfico-resumo no relatório
            </label>

            {!canConclude && (
              <div className="rounded border border-amber-400/40 bg-amber-400/40 p-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-300">
                <p className="mb-1 font-medium">Ainda há {pending.length} achado(s) marcado(s) como &quot;não avaliado&quot; — revise antes de concluir.</p>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-slate-800 dark:text-slate-200">
              {savedLocally ? "LUNA Safety Walk salvo neste dispositivo." : "LUNA Safety Walk registrado."}
              <br />
              {counts.pending > 0 ? "Enviando ao servidor assim que houver rede — acompanhe na barra acima." : "Já confirmado no servidor."}
            </p>
            <button type="button" onClick={startNewRonda} className="mt-2 rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-black">
              Novo LUNA Safety Walk
            </button>
          </div>
        )}
      </main>

      {step !== "done" && (
        <footer className="flex items-center justify-between gap-2 border-t border-black/10 px-4 py-3 dark:border-white/10">
          <button
            type="button"
            disabled={step === "A"}
            onClick={() => setStep(step === "C" ? "B" : "A")}
            className="rounded border border-black/15 px-4 py-2 text-sm text-slate-700 disabled:opacity-30 dark:border-white/15 dark:text-slate-300"
          >
            Voltar
          </button>
          {step === "A" && (
            <button
              type="button"
              disabled={!metadataComplete(metadata)}
              onClick={() => setStep("B")}
              className="rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Avançar
            </button>
          )}
          {step === "B" && (
            <button type="button" onClick={() => setStep("C")} className="rounded bg-cyan-500 px-4 py-2 text-sm font-medium text-black">
              Avançar
            </button>
          )}
          {step === "C" && (
            <button
              type="button"
              disabled={!canConclude}
              onClick={() => void handleConclude()}
              className="rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
            >
              Concluir LUNA Safety Walk
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
