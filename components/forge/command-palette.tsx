"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft } from "lucide-react";

export interface ForgeCommand {
  id: string;
  label: string;
  hint?: string;
  /** Termos extras que também devem casar a busca — ex. "git" deve achar
   *  "Ir para Versionamento" mesmo a palavra "git" não aparecendo no rótulo. */
  keywords?: string[];
  run: () => void;
}

/**
 * ADR-022, Forge v2 — a paleta de comandos que o pacote lista como faltando
 * no layout antigo (junto de barra de estado, indicador de saúde e
 * atalhos). Escopo deliberadamente contido: navega entre os destinos reais
 * do próprio layout (trilha, tema, gaveta) em vez de simular uma busca de
 * arquivo ou de repositório que não existe de verdade — o mesmo motivo que
 * já deixou "Buscar" e "Ajustes" fora da `ActivityRail`.
 *
 * ⌘K / Ctrl+K abre de qualquer lugar da tela; Esc fecha; ↑/↓ navegam;
 * Enter executa o comando destacado.
 */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: ForgeCommand[];
}) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => {
      const haystack = [command.label, ...(command.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      // Espera o modal montar antes de focar.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (highlighted >= filtered.length) setHighlighted(0);
  }, [filtered.length, highlighted]);

  function runHighlighted() {
    const command = filtered[highlighted];
    if (!command) return;
    onOpenChange(false);
    command.run();
  }

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => onOpenChange(false)}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[14vh]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onOpenChange(false);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            runHighlighted();
          }
        }}
        className="w-full max-w-lg overflow-hidden rounded-[var(--luna-radius)] border border-[var(--luna-accent)] bg-[var(--luna-bg)] shadow-2xl"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar comando ou destino…"
          className="w-full border-b border-[var(--luna-line)] bg-transparent px-4 py-3 text-sm text-[var(--luna-text)] placeholder:text-[var(--luna-text-3)] focus:outline-none"
        />
        <ul className="max-h-72 overflow-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-[var(--luna-text-3)]">Nenhum comando encontrado.</li>
          )}
          {filtered.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => {
                  onOpenChange(false);
                  command.run();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${
                  index === highlighted
                    ? "bg-[var(--luna-surface-3)] text-[var(--luna-text)]"
                    : "text-[var(--luna-text-2)]"
                }`}
              >
                {command.label}
                {command.hint && (
                  <span className="ml-auto font-[family-name:var(--luna-mono)] text-xs text-[var(--luna-text-3)]">
                    {command.hint}
                  </span>
                )}
                {index === highlighted && (
                  <CornerDownLeft className="h-3.5 w-3.5 text-[var(--luna-text-3)]" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
