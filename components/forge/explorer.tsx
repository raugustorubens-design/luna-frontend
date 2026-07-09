"use client";

// Portado de forge/apps/web/src/components/explorer/Explorer.tsx (monorepo `luna`).
import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listDirectory, type FilesystemEntry } from "@/lib/forge/api-client";
import { cn } from "@/lib/forge/utils";

interface TreeNodeProps {
  entry: FilesystemEntry;
  depth: number;
  activePath: string | null;
  onSelectFile: (path: string) => void;
}

function TreeNode({ entry, depth, activePath, onSelectFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FilesystemEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (entry.type === "file") {
      onSelectFile(entry.path);
      return;
    }

    if (!expanded && children === null) {
      setLoading(true);
      setError(null);
      try {
        const result = await listDirectory(entry.path);
        setChildren(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao listar diretório");
      } finally {
        setLoading(false);
      }
    }
    setExpanded((prev) => !prev);
  }

  const isActive = entry.type === "file" && activePath === entry.path;

  return (
    <div>
      <button
        onClick={toggle}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-muted",
          isActive && "bg-muted forge-accent-text",
        )}
      >
        {entry.type === "directory" ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {entry.type === "directory" ? <Folder className="h-3.5 w-3.5 shrink-0" /> : <File className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{entry.name}</span>
      </button>
      {expanded && loading && <div style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }} className="py-1 text-xs text-muted-foreground">carregando…</div>}
      {expanded && error && <div style={{ paddingLeft: `${(depth + 1) * 14 + 8}px` }} className="py-1 text-xs text-destructive">{error}</div>}
      {expanded &&
        children?.map((child) => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} activePath={activePath} onSelectFile={onSelectFile} />
        ))}
    </div>
  );
}

export function Explorer({ activePath, onSelectFile }: { activePath: string | null; onSelectFile: (path: string) => void }) {
  const [rootEntries, setRootEntries] = useState<FilesystemEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRoot() {
    setError(null);
    try {
      setRootEntries(await listDirectory("."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar raiz do projeto");
    }
  }

  useEffect(() => {
    loadRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Explorer</div>
      <ScrollArea className="flex-1">
        {error && (
          <div className="px-3 py-2 text-xs text-destructive">
            {error}
            <button onClick={loadRoot} className="ml-2 underline">
              tentar de novo
            </button>
          </div>
        )}
        {rootEntries?.map((entry) => (
          <TreeNode key={entry.path} entry={entry} depth={0} activePath={activePath} onSelectFile={onSelectFile} />
        ))}
      </ScrollArea>
    </div>
  );
}
