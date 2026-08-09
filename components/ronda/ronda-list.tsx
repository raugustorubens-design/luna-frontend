"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRondas, RondaSubmitError, type RondaSubmitResult } from "@/lib/ronda/api-client";

/**
 * Lista mínima de rondas já enviadas (extensão da Fase 1, CONV-013 —
 * `GET /convergia/ronda`). Deliberadamente sem dashboard/filtro/gráfico —
 * isso é o painel de gestão completo, decisão maior ainda pendente (P3 do
 * documento de extensão do ADR-021). Só data, local e quantidade de
 * achados, o bastante para escolher qual ronda abrir para editar.
 */
export function RondaList() {
  const [rondas, setRondas] = useState<RondaSubmitResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRondas()
      .then((result) => {
        if (!cancelled) setRondas(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof RondaSubmitError ? err.message : "Falha ao carregar as rondas enviadas.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">LUNA Safety Walk — rondas anteriores</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400">Toque numa ronda para editar achados ou a observação geral.</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {!error && rondas === null && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando…</p>}
        {rondas !== null && rondas.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma ronda enviada ainda.</p>
        )}

        <ul className="flex flex-col gap-2">
          {rondas?.map((ronda) => (
            <li key={ronda.rondaId}>
              <Link
                href={`/ronda/historico/${ronda.rondaId}`}
                className="flex flex-col rounded-lg border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{ronda.titulo}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {ronda.data} — {ronda.local} — {ronda.achadosCount} achado{ronda.achadosCount === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
