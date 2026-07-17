"use client";

// Forge MVP-08 — Workspace v0.1: integração fina com Claude Code, não
// reimplementação de editor/LSP/terminal (o Editor Monaco e o Terminal já
// existiam antes deste MVP — ver GENESIS/BUILDER.md, correção de premissa
// registrada lá). Este painel deliberadamente NÃO tenta rodar a CLI do
// Claude Code embutida no Terminal do Forge: lib/forge/terminal-server.ts
// documenta que o terminal daqui não usa um PTY real, e programas
// interativos de tela cheia (a própria CLI do Claude Code incluída) não
// renderizam corretamente nele — fingir essa integração seria pior do que
// não ter uma. A integração fina real de v0.1: visibilidade do que o
// Builder (Claude Code) já fez neste ecossistema, lida direto de
// GENESIS/BUILDER.md via `github.read_file` — capability madura e testada
// no Gateway (diferente de guardian.*/reporter.* usadas alhures no Forge,
// cujo status real no backend não foi confirmado nesta sessão).
import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readGithubFile } from "@/lib/forge/api-client";

const GENESIS_OWNER = "raugustorubens-design";
const GENESIS_REPO = "Luna-context.md";
const BUILDER_PATH = "GENESIS/BUILDER.md";
const RECENT_ENTRIES_LIMIT = 5;

interface BuilderLogEntry {
  heading: string;
  body: string;
}

/** Entradas de log em GENESIS/BUILDER.md começam com "## <data>" ou "## ID: ..." — ignora as demais seções (Owner, Entry format etc). */
function extractRecentEntries(markdown: string, limit: number): BuilderLogEntry[] {
  const isLogHeading = (line: string) => /^## (\d{4}-\d{2}-\d{2}|ID: )/.test(line);
  const entries: BuilderLogEntry[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const line of markdown.split("\n")) {
    if (isLogHeading(line)) {
      if (current) entries.push({ heading: current.heading, body: current.body.join("\n").trim() });
      current = { heading: line.replace(/^## /, ""), body: [] };
    } else if (current) {
      current.body.push(line);
    }
  }
  if (current) entries.push({ heading: current.heading, body: current.body.join("\n").trim() });

  return entries.slice(-limit).reverse();
}

export function ClaudeCodePanel() {
  const [entries, setEntries] = useState<BuilderLogEntry[] | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readGithubFile(GENESIS_OWNER, GENESIS_REPO, BUILDER_PATH)
      .then((file) => {
        setEntries(extractRecentEntries(file.content, RECENT_ENTRIES_LIMIT));
        setHtmlUrl(file.htmlUrl);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Falha ao ler GENESIS/BUILDER.md"));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Claude Code</div>
      <ScrollArea className="flex-1 px-3 pb-2">
        <p className="text-xs text-muted-foreground">
          Integração fina (Forge v0.1): Claude Code já é IDE-grade — este painel não o reimplementa, nem embute uma sessão
          interativa (o terminal do Forge não tem PTY real). Mostra a atividade recente do Builder, direto de{" "}
          {htmlUrl ? (
            <a href={htmlUrl} target="_blank" rel="noreferrer" className="underline">
              GENESIS/BUILDER.md
            </a>
          ) : (
            "GENESIS/BUILDER.md"
          )}
          .
        </p>

        {error && <p className="mt-3 border-t pt-2 text-destructive">{error}</p>}
        {!error && entries === null && <p className="mt-3 text-muted-foreground">…</p>}
        {!error && entries?.length === 0 && <p className="mt-3 text-muted-foreground">nenhuma entrada de log encontrada</p>}

        {entries?.map((entry) => (
          <div key={entry.heading} className="mt-3 border-t pt-2 text-xs">
            <div className="mb-1 font-semibold">{entry.heading}</div>
            <p className="whitespace-pre-wrap text-muted-foreground">{entry.body}</p>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}
