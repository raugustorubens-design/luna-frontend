"use client";

import { useMemo, useState } from "react";
import {
  emptyMetadata,
  emptyFindings,
  emptyClosing,
  metadataComplete,
  pendingCategories as pendingCategoriesOf,
  RISK_CATEGORY_LABELS,
  type RondaMetadata,
  type RondaFinding,
  type RondaClosing,
} from "@/lib/ronda/types";
import { enqueueRonda } from "@/lib/ronda/db";
import { useRondaQueue } from "@/lib/ronda/use-ronda-queue";
import { QueueStatusBar } from "./queue-status-bar";
import { FindingCard } from "./finding-card";
import { ThemeToggle } from "./theme-toggle";

type Step = "A" | "B" | "C" | "done";

export function RondaWizard() {
  const { counts, syncNow } = useRondaQueue();
  const [step, setStep] = useState<Step>("A");
  const [metadata, setMetadata] = useState<RondaMetadata>(emptyMetadata);
  const [findings, setFindings] = useState<RondaFinding[]>(emptyFindings);
  const [closing, setClosing] = useState<RondaClosing>(emptyClosing);
  const [savedLocally, setSavedLocally] = useState(false);

  const pendingCategories = useMemo(() => pendingCategoriesOf(findings), [findings]);
  const canConclude = pendingCategories.length === 0;

  function updateFinding(next: RondaFinding) {
    setFindings((current) => current.map((f) => (f.categoria === next.categoria ? next : f)));
  }

  async function handleConclude() {
    if (!canConclude) return;
    await enqueueRonda({ metadata, achados: findings, encerramento: closing });
    setSavedLocally(true);
    void syncNow(); // tenta enviar imediatamente se houver rede; se não, fica na fila e o evento 'online' cuida do resto.
    setStep("done");
  }

  function startNewRonda() {
    setMetadata(emptyMetadata());
    setFindings(emptyFindings());
    setClosing(emptyClosing());
    setSavedLocally(false);
    setStep("A");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <QueueStatusBar counts={counts} onSyncNow={() => void syncNow()} />

      <header className="flex items-start justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">LUNA Safety Walk</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {step === "A" && "Etapa 1 de 3 — Dados do LUNA Safety Walk"}
            {step === "B" && "Etapa 2 de 3 — Categorias de risco"}
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
          </div>
        )}

        {step === "B" && (
          <div className="flex flex-col gap-3">
            {findings.map((finding) => (
              <FindingCard key={finding.categoria} finding={finding} onChange={updateFinding} />
            ))}
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
                <p className="mb-1 font-medium">Ainda falta avaliar {pendingCategories.length} categoria(s) antes de concluir:</p>
                <ul className="list-inside list-disc">
                  {pendingCategories.map((f) => (
                    <li key={f.categoria}>{RISK_CATEGORY_LABELS[f.categoria]}</li>
                  ))}
                </ul>
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
