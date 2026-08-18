"use client";

import { GitBranch } from "lucide-react";
import { useGitStatus } from "@/lib/forge/use-git-status";
import { HealthDot } from "@/components/forge/health-dot";

/**
 * ADR-022, Forge v2 — rodapé fixo com o que a referência visual descreve
 * como "branch · alterados · problemas · saúde · Ln/Col".
 *
 * Armadilha 3 do pacote: só entra aqui o que tem dado real por trás.
 *
 * - Branch: real, de `GET /api/forge/git-status` (mesmo endpoint que
 *   `context-panel.tsx` já usa) — carregando/erro têm seus próprios rótulos,
 *   nunca um branch inventado.
 * - "Alterados" e "problemas": este repositório não expõe uma lista de
 *   arquivos modificados nem um linter/diagnóstico agregado em nenhuma rota
 *   hoje — inventar uma contagem seria o "verde mentiroso" que o pacote
 *   proíbe, só que em número. Omitidos até existir uma fonte real.
 * - Saúde: cinza, "sem leitura" — mesmo estado do indicador da CommandBar,
 *   pelo mesmo motivo.
 * - Ln/Col: `editor.tsx` não expõe posição do cursor (e não teve a
 *   assinatura alterada para isto, por regra do pacote) — mostrado como
 *   "sem cursor" em vez de coordenadas inventadas.
 */
export function StatusBar() {
  const gitStatus = useGitStatus();

  const branchLabel =
    gitStatus.status === "ready"
      ? gitStatus.data.branch
      : gitStatus.status === "error"
        ? "branch indisponível"
        : "lendo branch…";

  return (
    <div className="flex flex-none items-center gap-4 overflow-x-auto bg-[var(--luna-surface-2)] px-3 py-1 font-[family-name:var(--luna-mono)] text-[0.6875rem] text-[var(--luna-text-2)]">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <GitBranch className="h-[11px] w-[11px] text-[var(--luna-text-3)]" aria-hidden="true" />
        {branchLabel}
      </span>

      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <HealthDot state="none" />
        saúde · sem leitura
      </span>

      <span className="whitespace-nowrap text-[var(--luna-text-3)]">sem cursor</span>

      <span className="ml-auto whitespace-nowrap text-[var(--luna-text-3)]">
        {gitStatus.status === "ready" && gitStatus.data.lastCommit
          ? `último commit · ${gitStatus.data.lastCommit.message}`
          : null}
      </span>
    </div>
  );
}
