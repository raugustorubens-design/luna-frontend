"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  baixarRelatorioRonda,
  editarCuradoriaAchado,
  excluirCuradoriaAchado,
  gerarRelatorioRonda,
  getCuradoria,
  restaurarCuradoriaAchado,
  rondaFotoUrl,
  RondaSubmitError,
  type CuradoriaAchado,
} from "@/lib/ronda/api-client";
import { CLASSIFICATION_FILL_CLASS } from "./finding-card";
import { FINDING_CLASSIFICATION_LABELS, FINDING_SEVERITY_LABELS, type FindingClassification, type FindingSeverity } from "@/lib/ronda/types";

/**
 * Item 2 da fila (`2026-08-19-curadoria-relatorio.md`) — escopo Técnico:
 * sem caixa de seleção (isso é só do modelo Visual, que não existe ainda),
 * só editar descrição/ação recomendada e excluir com motivo. Classificação
 * e gravidade aparecem, mas não são editáveis aqui — mudá-las é mudar o
 * achado, decisão que pertence à tela de edição da ronda, não à curadoria.
 *
 * "A ronda não muda. O relatório carrega a versão curada." — nada aqui
 * chama `patchRonda`; toda mutação vai para `convergia_relatorio_curadoria`
 * via `luna-core`, `RelatorioCuradoriaStore`.
 */
export function RondaCuradoria({ rondaId }: { rondaId: string }) {
  const router = useRouter();
  const [achados, setAchados] = useState<CuradoriaAchado[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [gerarError, setGerarError] = useState<string | null>(null);
  const [gerarWarnings, setGerarWarnings] = useState<string[] | null>(null);
  const [formato, setFormato] = useState<"pptx" | "xlsx" | "docx">("pptx");
  const [orientacao, setOrientacao] = useState<"retrato" | "paisagem">("paisagem");
  const [papel, setPapel] = useState<"a4" | "oficio" | "carta">("a4");
  const orientacaoTocada = useRef(false);

  function handleFormatoChange(next: "pptx" | "xlsx" | "docx") {
    setFormato(next);
    if (!orientacaoTocada.current) {
      setOrientacao(next === "docx" ? "retrato" : "paisagem");
    }
  }

  function handleOrientacaoChange(next: "retrato" | "paisagem") {
    orientacaoTocada.current = true;
    setOrientacao(next);
  }

  const load = useCallback(async () => {
    try {
      const lista = await getCuradoria(rondaId);
      setAchados(lista.achados);
    } catch (err) {
      setLoadError(err instanceof RondaSubmitError ? err.message : "Falha ao carregar a curadoria.");
    }
  }, [rondaId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSalvarCampo(achadoId: string, campo: "descricao" | "acaoRecomendada", texto: string) {
    await editarCuradoriaAchado(rondaId, achadoId, campo, texto);
    await load();
  }

  async function handleExcluir(achadoId: string, motivo: string) {
    await excluirCuradoriaAchado(rondaId, achadoId, motivo);
    await load();
  }

  async function handleRestaurar(achadoId: string) {
    await restaurarCuradoriaAchado(rondaId, achadoId);
    await load();
  }

  async function handleGerar() {
    setGerando(true);
    setGerarError(null);
    setGerarWarnings(null);
    try {
      const { relatorio, warnings } = await gerarRelatorioRonda(rondaId, formato, orientacao, papel);
      const arquivo = await baixarRelatorioRonda(relatorio.relatorioId);
      const url = URL.createObjectURL(arquivo.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo.filename;
      link.click();
      URL.revokeObjectURL(url);
      if (warnings && warnings.length > 0) setGerarWarnings(warnings);
    } catch (err) {
      setGerarError(err instanceof RondaSubmitError ? err.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  if (loadError) {
    return <p className="p-4 text-sm text-red-400">{loadError}</p>;
  }

  if (!achados) {
    return <p className="p-4 text-sm text-[#6B7C99] dark:text-[#5A6E8A]">Carregando…</p>;
  }

  const incluidos = achados.filter((a) => !a.excluido);

  return (
    <div className="ronda-shell flex flex-col overflow-hidden">
      <header className="ronda-chrome-top shrink-0 border-b border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-[#0A1B3D] dark:text-[#DCE6F2]">Curadoria do relatório</h1>
            <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">Modelo Técnico — revise antes de gerar.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/ronda/historico/${rondaId}`)}
            className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-xs text-[#41557A] dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE]"
          >
            Voltar à ronda
          </button>
        </div>
      </header>

      <main className="ronda-scroll-pad min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="flex flex-col gap-3">
          {achados.length === 0 && (
            <p className="text-xs text-[#6B7C99] dark:text-[#5A6E8A]">Esta ronda não tem achado identificado — não há relatório a gerar.</p>
          )}

          {achados.map((achado) => (
            <CuradoriaAchadoCard
              key={achado.achadoId}
              achado={achado}
              onSalvarCampo={(campo, texto) => handleSalvarCampo(achado.achadoId, campo, texto)}
              onExcluir={(motivo) => handleExcluir(achado.achadoId, motivo)}
              onRestaurar={() => handleRestaurar(achado.achadoId)}
            />
          ))}
        </div>
      </main>

      <footer className="ronda-chrome-bottom shrink-0 border-t border-black/10 px-4 py-3 dark:border-[rgba(112,136,160,0.16)]">
        <p className="mb-2 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
          {incluidos.length} de {achados.length} achado{achados.length === 1 ? "" : "s"} vai{achados.length === 1 ? "" : "vão"} entrar no
          relatório.
        </p>
        <div className="mb-2 grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">
            Formato
            <select
              value={formato}
              onChange={(event) => handleFormatoChange(event.target.value as "pptx" | "xlsx" | "docx")}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-xs text-[#0A1B3D] [color-scheme:dark] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:light]"
            >
              <option value="pptx">PPTX</option>
              <option value="xlsx">XLSX</option>
              <option value="docx">DOCX</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">
            Orientação
            <select
              value={orientacao}
              onChange={(event) => handleOrientacaoChange(event.target.value as "retrato" | "paisagem")}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-xs text-[#0A1B3D] [color-scheme:dark] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:light]"
            >
              <option value="retrato">Retrato</option>
              <option value="paisagem">Paisagem</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">
            Papel
            <select
              value={papel}
              onChange={(event) => setPapel(event.target.value as "a4" | "oficio" | "carta")}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-xs text-[#0A1B3D] [color-scheme:dark] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2] dark:[color-scheme:light]"
            >
              <option value="a4">A4</option>
              <option value="oficio">Ofício</option>
              <option value="carta">Carta</option>
            </select>
          </label>
        </div>
        {gerarError && <p className="mb-2 text-xs text-red-400">{gerarError}</p>}
        {gerarWarnings && gerarWarnings.length > 0 && (
          <div className="mb-2 rounded border border-amber-400/60 bg-amber-400/10 p-2 text-[11px] text-amber-800 dark:text-amber-300">
            {gerarWarnings.map((warning, index) => (
              <p key={index}>{warning}</p>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={gerando || incluidos.length === 0}
          onClick={() => void handleGerar()}
          className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition-opacity disabled:opacity-40"
        >
          {gerando ? "Gerando…" : "Gerar relatório"}
        </button>
      </footer>
    </div>
  );
}

function CuradoriaAchadoCard({
  achado,
  onSalvarCampo,
  onExcluir,
  onRestaurar,
}: {
  achado: CuradoriaAchado;
  onSalvarCampo: (campo: "descricao" | "acaoRecomendada", texto: string) => Promise<void>;
  onExcluir: (motivo: string) => Promise<void>;
  onRestaurar: () => Promise<void>;
}) {
  const [descricao, setDescricao] = useState(achado.descricao);
  const [acaoRecomendada, setAcaoRecomendada] = useState(achado.acaoRecomendada);
  const [salvando, setSalvando] = useState<"descricao" | "acaoRecomendada" | null>(null);
  const [salvarErro, setSalvarErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [motivoErro, setMotivoErro] = useState<string | null>(null);

  useEffect(() => setDescricao(achado.descricao), [achado.descricao]);
  useEffect(() => setAcaoRecomendada(achado.acaoRecomendada), [achado.acaoRecomendada]);

  async function salvar(campo: "descricao" | "acaoRecomendada", texto: string, original: string) {
    if (texto === original) return;
    setSalvando(campo);
    setSalvarErro(null);
    try {
      await onSalvarCampo(campo, texto);
    } catch (err) {
      setSalvarErro(err instanceof RondaSubmitError ? err.message : "Falha ao salvar.");
    } finally {
      setSalvando(null);
    }
  }

  async function confirmarExclusao() {
    if (!motivo.trim()) {
      setMotivoErro("Motivo é obrigatório para excluir um achado do relatório.");
      return;
    }
    await onExcluir(motivo.trim());
    setExcluindo(false);
    setMotivo("");
    setMotivoErro(null);
  }

  const classificationLabel = achado.classificacao ? FINDING_CLASSIFICATION_LABELS[achado.classificacao as FindingClassification] : undefined;
  const classificationClass = achado.classificacao ? CLASSIFICATION_FILL_CLASS[achado.classificacao as FindingClassification] : undefined;
  const severityLabel = achado.gravidade ? FINDING_SEVERITY_LABELS[achado.gravidade as FindingSeverity] : undefined;
  const totalFotos = achado.fotoIds.length + achado.fotosEmbutidasCount;

  return (
    <div
      className={`flex flex-col gap-2 rounded border border-black/10 p-3 dark:border-[rgba(112,136,160,0.16)] ${
        achado.excluido ? "opacity-50" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {classificationLabel && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${classificationClass}`}>{classificationLabel}</span>
        )}
        {severityLabel && <span className="text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">Gravidade: {severityLabel}</span>}
        {achado.departamento && <span className="text-[11px] text-[#6B7C99] dark:text-[#5A6E8A]">{achado.departamento}</span>}
      </div>

      {totalFotos > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {achado.fotoIds.map((fotoId) => (
            <img key={fotoId} src={rondaFotoUrl(fotoId)} alt="" className="h-14 w-14 rounded border border-black/10 object-cover dark:border-[rgba(112,136,160,0.28)]" />
          ))}
          {achado.fotosEmbutidasCount > 0 && (
            <span className="flex h-14 w-14 items-center justify-center rounded border border-black/10 text-[10px] text-[#6B7C99] dark:border-[rgba(112,136,160,0.28)] dark:text-[#5A6E8A]">
              +{achado.fotosEmbutidasCount} offline
            </span>
          )}
        </div>
      )}

      {achado.excluido ? (
        <div className="flex flex-col gap-1 rounded border border-red-500/30 bg-red-500/5 p-2 text-xs">
          <p className="text-red-700 dark:text-red-300">Excluído do relatório: {achado.motivoExclusao}</p>
          <button type="button" onClick={() => void onRestaurar()} className="self-start text-[#003C90] underline dark:text-[#A0B8C8]">
            Restaurar
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
            Descrição {achado.descricaoEditada && <span className="text-[10px] text-[#003C90] dark:text-[#A0B8C8]">(editada)</span>}
            <textarea
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
              onBlur={() => void salvar("descricao", descricao, achado.descricao)}
              rows={2}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-[#0A1B3D] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2]"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-[#6B7C99] dark:text-[#5A6E8A]">
            Ação recomendada {achado.acaoRecomendadaEditada && <span className="text-[10px] text-[#003C90] dark:text-[#A0B8C8]">(editada)</span>}
            <textarea
              value={acaoRecomendada}
              onChange={(event) => setAcaoRecomendada(event.target.value)}
              onBlur={() => void salvar("acaoRecomendada", acaoRecomendada, achado.acaoRecomendada)}
              rows={2}
              className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm text-[#0A1B3D] dark:border-[rgba(112,136,160,0.28)] dark:text-[#DCE6F2]"
            />
          </label>

          {salvando && <p className="text-[10px] text-[#6B7C99] dark:text-[#5A6E8A]">Salvando…</p>}
          {salvarErro && <p className="text-xs text-red-400">{salvarErro}</p>}

          {excluindo ? (
            <div className="flex flex-col gap-1.5 rounded border border-red-500/30 bg-red-500/5 p-2">
              <label className="flex flex-col gap-1 text-xs text-red-700 dark:text-red-300">
                Motivo da exclusão (obrigatório)
                <input
                  value={motivo}
                  onChange={(event) => {
                    setMotivo(event.target.value);
                    setMotivoErro(null);
                  }}
                  className="rounded border border-red-500/40 bg-transparent px-2 py-1.5 text-sm text-[#0A1B3D] dark:text-[#DCE6F2]"
                />
              </label>
              {motivoErro && <p className="text-xs text-red-400">{motivoErro}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void confirmarExclusao()} className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white">
                  Confirmar exclusão
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExcluindo(false);
                    setMotivo("");
                    setMotivoErro(null);
                  }}
                  className="rounded border border-black/15 px-3 py-1.5 text-xs text-[#41557A] dark:border-[rgba(112,136,160,0.28)] dark:text-[#7E92AE]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setExcluindo(true)} className="self-start text-xs text-red-500 underline dark:text-red-400">
              Excluir do relatório
            </button>
          )}
        </>
      )}
    </div>
  );
}
