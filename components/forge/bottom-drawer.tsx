"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ClaudeCodePanel } from "@/components/forge/claude-code-panel";

// @xterm/xterm referencia globals de navegador (`self`) em escopo de módulo
// — precisa ficar fora da árvore renderizada no servidor, mesmo padrão que
// `forge-layout.tsx` (o layout antigo) já usa para este mesmo componente.
const Terminal = dynamic(() => import("@/components/forge/terminal").then((mod) => mod.Terminal), {
  ssr: false,
});

type DrawerTab = "terminal" | "claude-code";

/**
 * ADR-022, Forge v2 — gaveta inferior.
 *
 * Armadilha 1 do pacote, obrigatória: o Terminal mantém WebSocket vivo, e
 * `terminal.tsx` não muda. Colapsar a gaveta ESCONDE (altura 0 +
 * `overflow: hidden`), nunca desmonta — por isso o `<Terminal />` abaixo
 * fica sempre no DOM, com a visibilidade controlada por classe, igual ao
 * padrão `forceMount` que o layout antigo já usa no `TabsContent` do
 * Terminal. Trocar de aba para "Claude Code" é o mesmo mecanismo: esconde,
 * não desmonta — o socket sobrevive à troca de aba tanto quanto ao colapso.
 */
export function BottomDrawer() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<DrawerTab>("terminal");

  return (
    <div className="flex flex-none flex-col border-t border-[var(--luna-line-2)] bg-[var(--luna-surface)]">
      <div className="flex items-center gap-1 border-b border-[var(--luna-line)] px-2 py-1">
        {(
          [
            { id: "terminal" as const, label: "Terminal" },
            { id: "claude-code" as const, label: "Claude Code" },
          ]
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setOpen(true);
            }}
            aria-selected={tab === item.id && open}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              tab === item.id && open
                ? "bg-[var(--luna-surface-3)] text-[var(--luna-text)]"
                : "text-[var(--luna-text-3)] hover:text-[var(--luna-text-2)]"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={open ? "Recolher gaveta" : "Expandir gaveta"}
          className="ml-auto grid h-6 w-6 place-items-center rounded text-[var(--luna-text-3)] hover:bg-[var(--luna-surface-3)] hover:text-[var(--luna-text-2)]"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className={open ? "h-[14rem]" : "h-0"} style={{ overflow: "hidden" }}>
        <div className={tab === "terminal" ? "h-[14rem]" : "hidden"}>
          <Terminal />
        </div>
        <div className={tab === "claude-code" ? "h-[14rem] overflow-auto" : "hidden"}>
          <ClaudeCodePanel />
        </div>
      </div>
    </div>
  );
}
