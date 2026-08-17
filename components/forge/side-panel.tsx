"use client";

import { Explorer } from "@/components/forge/explorer";
import { GitPanel } from "@/components/forge/git-panel";
import { ContextPanel } from "@/components/forge/context-panel";
import type { RailTarget } from "@/components/forge/activity-rail";

/**
 * ADR-022, Forge v2 — casca que decide qual painel reusado mostrar ao lado
 * do editor, conforme o alvo ativo na trilha. Os três painéis (`Explorer`,
 * `GitPanel`, `ContextPanel`) são os mesmos do layout antigo, importados sem
 * alteração — esta função não escreve UI nova, só arranja.
 *
 * `target === "convergia"` não é tratado aqui: quem decide trocar a área
 * inteira pelo `ConvergiaPanel` é `forge-layout-v2.tsx`, porque Convergia
 * não é um painel lateral, é a área central inteira (mesmo comportamento da
 * aba "Convergia" no layout antigo).
 */
export function SidePanel({
  target,
  activePath,
  onSelectFile,
}: {
  target: Exclude<RailTarget, "convergia">;
  activePath: string | null;
  onSelectFile: (path: string) => void;
}) {
  if (target === "git") return <GitPanel />;
  if (target === "context") return <ContextPanel />;
  return <Explorer activePath={activePath} onSelectFile={onSelectFile} />;
}
