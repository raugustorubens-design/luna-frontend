"use client";

import { useEffect, useRef, useState } from "react";
import {
  FLAG_LABELS,
  RISK_STATES,
  RISK_STATE_LABELS,
  FINDING_CLASSIFICATIONS,
  FINDING_CLASSIFICATION_LABELS,
  FINDING_SEVERITIES,
  FINDING_SEVERITY_LABELS,
  type RondaFinding,
  type RondaPhoto,
  type RiskState,
  type FindingClassification,
} from "@/lib/ronda/types";
import { compressPhoto } from "@/lib/ronda/photo";
import { saveOriginalPhoto } from "@/lib/ronda/db";
import { getFotoSugestao } from "@/lib/ronda/api-client";

/**
 * Cores exatas do protótipo real do relatório final (não aproximadas para
 * a paleta padrão do Tailwind) — mesmo par usado no selo do relatório e
 * aqui no wizard, decisão do Architect para manter as duas telas
 * consistentes. Preenchimento sólido (classe estática, não um template
 * dinâmico, para o Tailwind JIT conseguir escanear a classe no build) +
 * texto claro por cima — exceto "Atenção" (ver abaixo).
 *
 * "Atenção" (`#E8A33D`) usa texto escuro (`#1E2761`, Midnight, já usado em
 * outro lugar do projeto), não branco: medido nesta sessão, texto branco
 * sobre esse fundo dá só 2.16:1 de contraste (abaixo de AA, 4.5:1) — o
 * fundo em si já é claro demais pra qualquer texto quase-branco passar.
 * Fundo mantido exato (cor de marca, do protótipo), corrigido só o texto.
 * Positivo/Não Conformidade continuam com texto branco — já passam AA.
 */
const CLASSIFICATION_FILL_CLASS: Record<FindingClassification, string> = {
  positivo: "border-transparent bg-[#2E7D32] text-white",
  atencao: "border-transparent bg-[#E8A33D] text-[#1E2761]",
  nao_conformidade: "border-transparent bg-[#C62828] text-white",
};

/**
 * Um card por achado (achado dinâmico — não mais um por categoria fixa, ver
 * `lib/ronda/types.ts`). O seletor de estado de 3 opções continua existindo
 * (`requiredWhenIdentified` no backend depende dele), mas um achado nasce
 * pelo "+" já como "identificado" — "não avaliado" só aparece se alguém
 * reverter manualmente. Foto nunca é obrigatória, em nenhum estado — por
 * isso não faz parte da validação local deste componente, só os 4 campos
 * que o backend também exige quando `estado === "identificado"`.
 */
export function FindingCard({
  finding,
  onChange,
  onDuplicate,
  onRemove,
  onSuggestionApplied,
}: {
  finding: RondaFinding;
  onChange: (next: RondaFinding) => void;
  /** "+" num achado já preenchido, pra duplicar (Decisão 3, refinamento 3) — omitido esconde o botão (ex. card ainda sem campos preenchidos). */
  onDuplicate?: (finding: RondaFinding) => void;
  /** Remove o achado da lista do chamador. Diferente de `onDuplicate`, vale pra **qualquer** achado, em qualquer estado — não só os "identificados" nem só os duplicados. Omitido esconde o botão. */
  onRemove?: (findingId: string) => void;
  /** Reporta pro chamador quais campos uma sugestão de foto (Fase 4) de fato preencheu, pra Parte 3 (correção humana vira aprendizado) comparar sugerido-vs-salvo na hora de concluir. */
  onSuggestionApplied?: (findingId: string, sugerido: Partial<RondaFinding>) => void;
}) {
  const [compressing, setCompressing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<Set<"classificacao" | "gravidade">>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A leitura de foto (Fase 4) é assíncrona e pode terminar depois de vários
  // re-renders — `finding` capturado no fechamento de `handlePhotoChange` no
  // momento do upload ficaria desatualizado se o humano editar outro campo
  // enquanto a sugestão ainda carrega. Um ref sincronizado a cada render
  // garante que o merge da sugestão parte do valor mais recente, não do
  // instantâneo de quando o upload começou.
  const findingRef = useRef(finding);
  useEffect(() => {
    findingRef.current = finding;
  }, [finding]);

  const title = (finding.flagId && FLAG_LABELS[finding.flagId]) || "Achado manual";

  function setEstado(estado: RiskState) {
    if (estado === "identificado") {
      onChange({ ...finding, estado });
    } else {
      // Volta pra "não avaliado"/"inexistente" descarta os campos de achado
      // já preenchidos — evita enviar dado de um achado que o usuário
      // decidiu não manter, mas sem perder a foto: se quiser reconsiderar,
      // o usuário volta pra "identificado" e refaz (raro o bastante para
      // não justificar guardar um "achado desfeito" escondido em memória).
      onChange({ id: finding.id, flagId: finding.flagId, estado });
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setPhotoError(null);
    setCompressing(true);
    try {
      const fileList = Array.from(files);
      const compressed = await Promise.all(fileList.map(compressPhoto));
      const startIndex = (finding.fotos ?? []).length;
      onChange({ ...finding, fotos: [...(finding.fotos ?? []), ...compressed] });
      // Foto original (não comprimida) preservada só localmente — Decisão 4
      // da revisão de arquitetura, guardar a versão de maior resolução pra
      // uma futura "versão de apresentação" (Fase 2) poder trabalhar com
      // qualidade melhor que o teto de 1280px da versão de campo. Nunca faz
      // parte de `fotos` (que é o que a fila offline envia) — só um registro
      // paralelo em IndexedDB, associado ao mesmo achado por `id`.
      await Promise.all(fileList.map((file, i) => saveOriginalPhoto(finding.id, startIndex + i, file)));

      void applyPhotoSuggestion(compressed[0]);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Falha ao processar a foto.");
    } finally {
      setCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /**
   * Segunda fonte de sugestão (Fase 4 do ADR-021 original, Decisão 2 da
   * revisão de arquitetura) — dispara em paralelo ao upload, sem bloquear
   * (`void`, não fica no `try` acima: uma sugestão de foto que falha não é
   * erro de upload). Só preenche campo vazio — nunca sobrescreve o que o
   * humano já escreveu, mesmo princípio de "+" pré-preenchendo sem forçar.
   * Passa sempre pelo formulário completo (`onChange` normal), nunca grava
   * sozinha.
   */
  async function applyPhotoSuggestion(photo: RondaPhoto) {
    const sugestao = await getFotoSugestao(photo);
    if (!sugestao) return;

    const current = findingRef.current;
    const updates: Partial<RondaFinding> = {};
    const sugerido: Partial<RondaFinding> = {};

    if (!current.descricao && sugestao.descricao) {
      updates.descricao = sugestao.descricao;
      sugerido.descricao = sugestao.descricao;
    }
    if (!current.classificacao && sugestao.classificacao) {
      updates.classificacao = sugestao.classificacao;
      sugerido.classificacao = sugestao.classificacao;
    }
    if (!current.gravidade && sugestao.gravidade) {
      updates.gravidade = sugestao.gravidade;
      sugerido.gravidade = sugestao.gravidade;
    }

    if (Object.keys(updates).length > 0) {
      onChange({ ...current, ...updates });
      onSuggestionApplied?.(current.id, sugerido);
    }
    setLowConfidenceFields(new Set(sugestao.camposIncertos));
  }

  function removePhoto(index: number) {
    onChange({ ...finding, fotos: (finding.fotos ?? []).filter((_, i) => i !== index) });
  }

  // Comportamento padrão de radiogroup (WAI-ARIA APG): setas move o foco E a
  // seleção (não só o foco) entre as opções, com wrap-around nas pontas —
  // o clique sozinho (já existente) não dá isso de graça pra teclado/leitor
  // de tela, precisa de roving tabIndex + handler de teclado.
  function handleClassificationKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % FINDING_CLASSIFICATIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + FINDING_CLASSIFICATIONS.length) % FINDING_CLASSIFICATIONS.length;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextOption = FINDING_CLASSIFICATIONS[nextIndex];
    onChange({ ...finding, classificacao: nextOption });
    setLowConfidenceFields((current) => {
      const next = new Set(current);
      next.delete("classificacao");
      return next;
    });
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const nextButton = group?.querySelectorAll('[role="radio"]')[nextIndex] as HTMLElement | undefined;
    nextButton?.focus();
  }

  const isIdentified = finding.estado === "identificado";

  return (
    <div className="rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="flex items-center gap-2">
          {finding.estado === "nao_avaliado" && (
            <span className="rounded-full bg-amber-400/40 px-2 py-0.5 text-[10px] text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
              pendente
            </span>
          )}
          {onDuplicate && finding.estado === "identificado" && (
            <button
              type="button"
              onClick={() => onDuplicate(finding)}
              className="rounded border border-black/15 px-2 py-1 text-[10px] text-slate-600 hover:border-cyan-500 hover:text-cyan-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-cyan-300"
            >
              + Duplicar
            </button>
          )}
          {/*
            Sem a condição de `estado === "identificado"` que o "+ Duplicar"
            tem logo acima: remover vale pra qualquer achado, inclusive o que
            ainda está "não avaliado"/"inexistente" ou vazio.

            `confirm()` nativo, não modal customizado — mesma disciplina de
            "não apagar sem intenção clara" do resto do sistema, e o
            suficiente aqui: some da lista sem lugar nenhum pra desfazer.
          */}
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Remover o achado "${title}"? Não é possível desfazer.`)) {
                  onRemove(finding.id);
                }
              }}
              aria-label={`Remover achado — ${title}`}
              className="rounded border border-black/15 px-2 py-1 text-[10px] leading-none text-slate-600 hover:border-red-500 hover:text-red-600 dark:border-white/15 dark:text-slate-400 dark:hover:border-red-400 dark:hover:text-red-300"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Estado — ${title}`}>
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

          <div
            className={`flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400 ${
              lowConfidenceFields.has("classificacao") ? "rounded border border-amber-400/60 p-2 -m-2" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              Classificação
              {lowConfidenceFields.has("classificacao") && (
                <span className="rounded-full bg-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
                  IA não teve certeza — revise
                </span>
              )}
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={`Classificação — ${title}`}
            >
              {FINDING_CLASSIFICATIONS.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={finding.classificacao === option}
                  tabIndex={finding.classificacao === option || (!finding.classificacao && index === 0) ? 0 : -1}
                  onClick={() => {
                    onChange({ ...finding, classificacao: option });
                    setLowConfidenceFields((current) => {
                      const next = new Set(current);
                      next.delete("classificacao");
                      return next;
                    });
                  }}
                  onKeyDown={(event) => handleClassificationKeyDown(event, index)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    finding.classificacao === option
                      ? CLASSIFICATION_FILL_CLASS[option]
                      : "border-black/15 text-slate-600 hover:border-black/30 dark:border-white/15 dark:text-slate-400 dark:hover:border-white/30"
                  }`}
                >
                  {FINDING_CLASSIFICATION_LABELS[option]}
                </button>
              ))}
            </div>
          </div>

          <label
            className={`flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-400 ${
              lowConfidenceFields.has("gravidade") ? "rounded border border-amber-400/60 p-2 -m-2" : ""
            }`}
          >
            <span className="flex items-center gap-1.5">
              Gravidade
              {lowConfidenceFields.has("gravidade") && (
                <span className="rounded-full bg-amber-400/40 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-400/15 dark:text-amber-300">
                  IA não teve certeza — revise
                </span>
              )}
            </span>
            {/*
              `color-scheme` invertido de propósito em relação ao tema da
              página (escuro na página clara, claro na página escura): o menu
              suspenso nativo herda o `color-scheme` do `<select>`, então
              inverter aqui é o que faz a lista aberta contrastar com o fundo
              em vez de se confundir com ele.

              O campo fechado continua acompanhando o tema da página porque a
              aparência dele vem das classes explícitas ao lado
              (`bg-transparent`, `text-slate-900 dark:text-slate-100`,
              `border-black/15 dark:border-white/15`), que ganham do
              `color-scheme`. O único resquício que o `color-scheme` ainda
              controla no campo fechado é a setinha desenhada pelo próprio
              navegador — ver a entrada no BUILDER.md para o que a verificação
              visual mostrou sobre ela.
            */}
            <select
              value={finding.gravidade ?? ""}
              onChange={(event) => {
                onChange({ ...finding, gravidade: event.target.value as RondaFinding["gravidade"] });
                setLowConfidenceFields((current) => {
                  const next = new Set(current);
                  next.delete("gravidade");
                  return next;
                });
              }}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-slate-900 [color-scheme:dark] dark:border-white/15 dark:text-slate-100 dark:[color-scheme:light]"
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
