"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRonda, patchRonda, RondaSubmitError, type RondaDetail } from "@/lib/ronda/api-client";
import type { RondaFinding } from "@/lib/ronda/types";
import { FindingCard } from "./finding-card";

/**
 * Edição de uma ronda já enviada (extensão da Fase 1, CONV-013 —
 * `PATCH /convergia/ronda/:id`). Reaproveita `FindingCard`, o mesmo
 * componente de achado do wizard original — nenhuma UI nova de achado só
 * para edição. Só permite adicionar/remover/editar achado e a observação
 * geral; excluir a ronda inteira não faz parte desta tela (decisão
 * destrutiva separada, fora de escopo aqui).
 */
export function RondaEditor({ rondaId }: { rondaId: string }) {
  const router = useRouter();
  const [ronda, setRonda] = useState<RondaDetail | null>(null);
  const [findings, setFindings] = useState<RondaFinding[]>([]);
  const [observacoesGerais, setObservacoesGerais] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRonda(rondaId)
      .then((detail) => {
        if (cancelled) return;
        setRonda(detail);
        setFindings(detail.achados);
        setObservacoesGerais(detail.encerramento.observacoesGerais ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof RondaSubmitError ? err.message : "Falha ao carregar a ronda.");
      });
    return () => {
      cancelled = true;
    };
  }, [rondaId]);

  function updateFinding(next: RondaFinding) {
    setFindings((current) => current.map((f) => (f.categoria === next.categoria ? next : f)));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const summary = await patchRonda(rondaId, {
        achados: findings,
        encerramento: { observacoesGerais },
      });
      setRonda((current) => (current ? { ...current, achados: findings, encerramento: { ...current.encerramento, observacoesGerais } } : current));
      setSaved(true);
      void summary;
    } catch (err) {
      setSaveError(err instanceof RondaSubmitError ? err.message : "Falha ao salvar a edição.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return <p className="p-4 text-sm text-red-400">{loadError}</p>;
  }

  if (!ronda) {
    return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Carregando…</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-start justify-between gap-2 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Editar LUNA Safety Walk</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {ronda.metadata.titulo} — {ronda.metadata.local} — {ronda.metadata.data}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/ronda/historico")}
          className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-xs text-slate-700 dark:border-white/15 dark:text-slate-300"
        >
          Voltar à lista
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {findings.map((finding) => (
            <FindingCard key={finding.categoria} finding={finding} onChange={updateFinding} />
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
          {saved && <p className="text-xs text-emerald-500">Alterações salvas.</p>}
        </div>
      </main>

      <footer className="border-t border-black/10 px-4 py-3 dark:border-white/10">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
      </footer>
    </div>
  );
}
