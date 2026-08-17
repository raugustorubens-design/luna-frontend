"use client";

import Link from "next/link";
import { Folder, Search } from "lucide-react";
import { useForgeProject } from "@/lib/forge/project-context";
import { KNOWN_FORGE_PROJECTS } from "@/lib/forge/memory";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HealthDot } from "@/components/forge/health-dot";

/** Mesmo seletor de projeto de `forge-layout.tsx` (o antigo), só que morando
 *  aqui — o v2 não importa nada de dentro do arquivo antigo, para os dois
 *  ficarem livres para divergir sem se atropelar. */
function ProjectSelector() {
  const { project, setProject } = useForgeProject();
  return (
    <select
      value={project}
      onChange={(event) => setProject(event.target.value)}
      title="Projeto ativo"
      className="rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] bg-transparent px-1.5 py-0.5 font-[family-name:var(--luna-mono)] text-xs text-[var(--luna-text-2)] [color-scheme:var(--luna-scheme)]"
    >
      {KNOWN_FORGE_PROJECTS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

/**
 * ADR-022, Forge v2 — barra superior. Reúne o que a barra de cabeçalho do
 * v1 já tinha (marca, projeto, link de saída) com o que faltava (gatilho da
 * paleta de comandos, indicador de saúde).
 *
 * Armadilha 3 do pacote: sem endpoint de saúde real por trás, o indicador é
 * cinza e diz "sem leitura" — nunca verde. Ver `health-dot.tsx`.
 */
export function CommandBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-[var(--luna-line-2)] bg-[var(--luna-surface)] px-3 py-1.5">
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[var(--luna-accent)]"
          style={{ boxShadow: "0 0 12px var(--luna-accent)" }}
        />
        <span className="font-[family-name:var(--luna-display)] text-sm font-bold text-[var(--luna-accent)]">
          LUNA Forge
        </span>
        <span className="text-xs text-[var(--luna-text-3)]">MVP-04 · Dev Mode v2</span>
      </span>

      <span className="flex items-center gap-1.5 rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] bg-[var(--luna-surface-2)] px-1.5 py-0.5 font-[family-name:var(--luna-mono)] text-xs text-[var(--luna-text-2)]">
        <Folder className="h-3.5 w-3.5 text-[var(--luna-text-3)]" aria-hidden="true" />
        <ProjectSelector />
      </span>

      <button
        type="button"
        onClick={onOpenPalette}
        className="mx-auto flex max-w-md flex-1 items-center gap-2 rounded-[var(--luna-radius)] border border-[var(--luna-line-2)] bg-[var(--luna-surface-2)] px-3 py-1.5 text-xs text-[var(--luna-text-3)] transition-colors hover:border-[var(--luna-line-3)] hover:text-[var(--luna-text-2)]"
      >
        <Search className="h-[13px] w-[13px]" aria-hidden="true" />
        Buscar comando ou destino
        <kbd className="ml-auto rounded border border-[var(--luna-line-2)] px-1 font-[family-name:var(--luna-mono)] text-[0.625rem]">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <span
          title="Sem endpoint de saúde configurado neste ambiente"
          className="flex items-center gap-1.5 font-[family-name:var(--luna-mono)] text-xs text-[var(--luna-text-2)]"
        >
          <HealthDot state="none" />
          sem leitura
        </span>
        <ThemeToggle />
        <Link
          href="/v2"
          className="text-xs text-[var(--luna-text-3)] transition-colors hover:text-[var(--luna-accent)]"
        >
          Sair do Forge →
        </Link>
      </div>
    </header>
  );
}
