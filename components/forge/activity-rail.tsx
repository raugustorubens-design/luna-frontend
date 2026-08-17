"use client";

import { Files, FileText, GitBranch, Brain, type LucideIcon } from "lucide-react";

export type RailTarget = "files" | "git" | "context" | "convergia";

const ITEMS: { target: RailTarget; label: string; icon: LucideIcon }[] = [
  { target: "files", label: "Arquivos", icon: Files },
  { target: "git", label: "Versionamento", icon: GitBranch },
  { target: "context", label: "Memória e contexto", icon: Brain },
  { target: "convergia", label: "Convergia", icon: FileText },
];

/**
 * ADR-022, Forge v2 — trilha de ícones à esquerda. É a casca em cima do que
 * já existe: cada alvo escolhe qual painel reusado aparece ao lado
 * (`side-panel.tsx`) ou, no caso de "convergia", troca a área central
 * inteira pelo painel — o mesmo comportamento de tomar a tela toda que a
 * aba "Convergia" já tinha no layout antigo (ver `forge-layout.tsx`).
 *
 * Só quatro alvos, todos apoiados em painel real e reusado sem alteração de
 * assinatura. "Buscar" e "Ajustes" apareciam na referência visual, mas não
 * entraram aqui: nenhum dos dois tem uma função real por trás hoje, e um
 * botão que não faz nada é pior que a trilha ficar mais curta.
 */
export function ActivityRail({
  value,
  onChange,
}: {
  value: RailTarget;
  onChange: (target: RailTarget) => void;
}) {
  return (
    <nav
      aria-label="Painéis do Forge"
      className="flex w-11 flex-none flex-col items-center gap-1 border-r border-[var(--luna-line-2)] bg-[var(--luna-surface)] py-2"
    >
      {ITEMS.map((item) => {
        const active = item.target === value;
        return (
          <button
            key={item.target}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-current={active}
            onClick={() => onChange(item.target)}
            className={`relative grid h-8 w-8 place-items-center rounded-[var(--luna-radius)] transition-colors ${
              active
                ? "text-[var(--luna-accent)]"
                : "text-[var(--luna-text-3)] hover:bg-[var(--luna-surface-3)] hover:text-[var(--luna-text-2)]"
            }`}
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute -left-2 top-1 bottom-1 w-0.5 bg-[var(--luna-accent)]"
              />
            )}
            <item.icon className="h-[17px] w-[17px]" strokeWidth={1.7} aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
