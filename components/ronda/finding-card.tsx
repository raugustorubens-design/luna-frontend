"use client";

import { useRef, useState } from "react";
import {
  RISK_CATEGORY_LABELS,
  RISK_STATES,
  RISK_STATE_LABELS,
  FINDING_CLASSIFICATIONS,
  FINDING_CLASSIFICATION_LABELS,
  FINDING_SEVERITIES,
  FINDING_SEVERITY_LABELS,
  type RondaFinding,
  type RiskState,
} from "@/lib/ronda/types";
import { compressPhoto } from "@/lib/ronda/photo";

/**
 * Um card por categoria de risco (ADR-021, Decisão 1, refinamento): o
 * seletor de estado de 3 opções é a primeira coisa que aparece — "não
 * avaliado" (pendente, bloqueia a conclusão), "risco identificado" (abre o
 * formulário completo do achado) e "considerado e inexistente" (marcação
 * explícita, sem exigir mais nada, mas não é o mesmo que deixar em branco).
 * Foto nunca é obrigatória, em nenhum estado — por isso não faz parte da
 * validação local deste componente, só os 4 campos que o backend também
 * exige quando `estado === "identificado"`.
 */
export function FindingCard({ finding, onChange }: { finding: RondaFinding; onChange: (next: RondaFinding) => void }) {
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setEstado(estado: RiskState) {
    if (estado === "identificado") {
      onChange({ ...finding, estado });
    } else {
      // Volta pra "não avaliado"/"inexistente" descarta os campos de achado
      // já preenchidos — evita enviar dado de um achado que o usuário
      // decidiu não manter, mas sem perder a foto: se quiser reconsiderar,
      // o usuário volta pra "identificado" e refaz (raro o bastante para
      // não justificar guardar um "achado desfeito" escondido em memória).
      onChange({ categoria: finding.categoria, estado });
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setPhotoError(null);
    setCompressing(true);
    try {
      const compressed = await Promise.all(Array.from(files).map(compressPhoto));
      onChange({ ...finding, fotos: [...(finding.fotos ?? []), ...compressed] });
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Falha ao processar a foto.");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePhoto(index: number) {
    onChange({ ...finding, fotos: (finding.fotos ?? []).filter((_, i) => i !== index) });
  }

  const isIdentified = finding.estado === "identificado";

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{RISK_CATEGORY_LABELS[finding.categoria]}</h3>
        {finding.estado === "nao_avaliado" && (
          <span className="rounded-full bg-amber-400/40 px-2 py-0.5 text-[10px] text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
            pendente
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Estado — ${RISK_CATEGORY_LABELS[finding.categoria]}`}>
        {RISK_STATES.map((estado) => (
          <button
            key={estado}
            type="button"
            role="radio"
            aria-checked={finding.estado === estado}
            onClick={() => setEstado(estado)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              finding.estado === estado
                ? estado === "identificado"
                  ? "border-red-400 bg-red-400/40 text-red-900 dark:bg-red-400/15 dark:text-red-300"
                  : estado === "inexistente"
                    ? "border-emerald-400 bg-emerald-400/40 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-300"
                    : "border-amber-400 bg-amber-400/40 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300"
                : "border-black/15 text-slate-600 hover:border-black/30 dark:border-white/15 dark:text-slate-400 dark:hover:border-white/30"
            }`}
          >
            {RISK_STATE_LABELS[estado]}
          </button>
        ))}
      </div>

      {isIdentified && (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3 dark:border-white/10">
          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Departamento
            <input
              type="text"
              value={finding.departamento ?? ""}
              onChange={(event) => onChange({ ...finding, departamento: event.target.value })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
              placeholder="ex. Manutenção"
            />
          </label>

          <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <span>Foto (opcional — nunca é obrigatória para avançar)</span>
            <div className="flex flex-wrap gap-2">
              {(finding.fotos ?? []).map((photo, index) => (
                <div key={index} className="relative h-16 w-16 overflow-hidden rounded border border-black/15 dark:border-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:${photo.mimeType};base64,${photo.dataBase64}`} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 text-[10px] text-white"
                    aria-label="Remover foto"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-black/25 text-[10px] text-slate-600 hover:border-cyan-500 hover:text-cyan-600 disabled:opacity-50 dark:border-white/25 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
              >
                {compressing ? "…" : "+ Foto"}
              </button>
            </div>
            {/* capture="environment" abre a câmera traseira nativa direto — input padrão do navegador, sem lib. */}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoChange} className="hidden" />
            {photoError && <p className="text-red-400">{photoError}</p>}
          </div>

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Classificação
            <select
              value={finding.classificacao ?? ""}
              onChange={(event) => onChange({ ...finding, classificacao: event.target.value as RondaFinding["classificacao"] })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              <option value="" disabled>
                selecione…
              </option>
              {FINDING_CLASSIFICATIONS.map((option) => (
                <option key={option} value={option}>
                  {FINDING_CLASSIFICATION_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Gravidade
            <select
              value={finding.gravidade ?? ""}
              onChange={(event) => onChange({ ...finding, gravidade: event.target.value as RondaFinding["gravidade"] })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
            >
              <option value="" disabled>
                selecione…
              </option>
              {FINDING_SEVERITIES.map((option) => (
                <option key={option} value={option}>
                  {FINDING_SEVERITY_LABELS[option]}
                </option>
              ))}
            </select>
          </label>

          {/* textarea nativa, sem componente customizado — teclado nativo aparece normalmente, o que garante ditado por voz de graça (ADR-021). */}
          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Descrição
            <textarea
              value={finding.descricao ?? ""}
              onChange={(event) => onChange({ ...finding, descricao: event.target.value })}
              rows={3}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 dark:border-white/15 dark:text-slate-100"
              placeholder="O que foi observado…"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Ação recomendada (opcional)
            <input
              type="text"
              value={finding.acaoRecomendada ?? ""}
              onChange={(event) => onChange({ ...finding, acaoRecomendada: event.target.value })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Responsável pela ação (opcional)
            <input
              type="text"
              value={finding.responsavel ?? ""}
              onChange={(event) => onChange({ ...finding, responsavel: event.target.value })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400">
            Prazo (opcional)
            <input
              type="date"
              value={finding.prazo ?? ""}
              onChange={(event) => onChange({ ...finding, prazo: event.target.value })}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:light] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
