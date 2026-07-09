"use client";

// Portado de forge/apps/web/src/components/context-panel/ContextPanel.tsx (monorepo `luna`).
import { Fragment, useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readFile, fetchLocalGitStatus, type LocalGitStatus } from "@/lib/forge/api-client";

/**
 * Não existe hoje um endpoint HTTP do Context Hub (ver ARCHITECTURE.md do
 * Forge original) — este painel lê LUNA_CONTEXT.md diretamente via capability
 * de filesystem (working directory local) e monta a visão sem inventar um
 * resumo por IA. Missão atual é o início real do arquivo, não uma reescrita.
 */
const CONTEXT_PATHS = ["luna_context/LUNA_CONTEXT.md", "LUNA_CONTEXT.md"];

function extractMission(content: string): string {
  const withoutHeading = content.replace(/^#.*\n/, "").trim();
  const firstParagraph = withoutHeading.split(/\n\s*\n/)[0] ?? "";
  return firstParagraph.slice(0, 400);
}

export function ContextPanel() {
  const [gitStatus, setGitStatus] = useState<LocalGitStatus | null>(null);
  const [contextContent, setContextContent] = useState<string | null>(null);
  const [contextPath, setContextPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalGitStatus().then(setGitStatus).catch(() => setGitStatus(null));

    (async () => {
      for (const path of CONTEXT_PATHS) {
        try {
          const content = await readFile(path);
          setContextContent(content);
          setContextPath(path);
          return;
        } catch {
          continue;
        }
      }
      setError("LUNA_CONTEXT.md não encontrado no diretório de trabalho atual do Gateway.");
    })();
  }, []);

  const mission = contextContent ? extractMission(contextContent) : null;

  const fields = [
    { label: "Sistema atual", value: "LUNA Forge" },
    { label: "Órgão atual", value: "Forge" },
    { label: "MVP atual", value: "Forge MVP-01" },
    { label: "Branch", value: gitStatus?.branch ?? "…" },
    { label: "Último checkpoint", value: gitStatus?.lastCommit ? `${gitStatus.lastCommit.sha.slice(0, 7)} — ${gitStatus.lastCommit.message}` : "…" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contexto</div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {fields.map((field) => (
            <Fragment key={field.label}>
              <dt className="text-muted-foreground">{field.label}</dt>
              <dd className="truncate">{field.value}</dd>
            </Fragment>
          ))}
        </dl>
        <div className="mt-3 border-t pt-2">
          <div className="mb-1 text-muted-foreground">Missão atual {contextPath && <span className="font-mono">({contextPath})</span>}</div>
          {error && <p className="text-destructive">{error}</p>}
          {mission && <p className="whitespace-pre-wrap">{mission}</p>}
        </div>
      </ScrollArea>
    </div>
  );
}
