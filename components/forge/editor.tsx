"use client";

// Portado de forge/apps/web/src/components/editor/Editor.tsx (monorepo `luna`).
// Única mudança de fundo: MonacoEditor é carregado via next/dynamic com
// ssr:false, já que monaco-editor depende de `window`/`self` e o App Router
// renderiza client components no servidor também na primeira passada.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readFile, writeFile } from "@/lib/forge/api-client";
import { cn } from "@/lib/forge/utils";
import { ensureMonacoConfigured } from "@/lib/forge/monaco-setup";

if (typeof window !== "undefined") ensureMonacoConfigured();

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface OpenFile {
  path: string;
  content: string;
  savedContent: string;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  py: "python",
  css: "css",
  html: "html",
  yaml: "yaml",
  yml: "yaml",
};

function languageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[ext] ?? "plaintext";
}

export function Editor({ openPath }: { openPath: string | null }) {
  const [files, setFiles] = useState<OpenFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!openPath) return;

    const alreadyOpen = files.some((file) => file.path === openPath);
    if (alreadyOpen) {
      setActivePath(openPath);
      return;
    }

    let cancelled = false;
    readFile(openPath)
      .then((content) => {
        if (cancelled) return;
        setFiles((prev) => [...prev, { path: openPath, content, savedContent: content }]);
        setActivePath(openPath);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao abrir arquivo"));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPath]);

  const activeFile = files.find((file) => file.path === activePath) ?? null;

  function closeTab(path: string) {
    setFiles((prev) => prev.filter((file) => file.path !== path));
    if (activePath === path) {
      const remaining = files.filter((file) => file.path !== path);
      setActivePath(remaining.at(-1)?.path ?? null);
    }
  }

  function updateContent(path: string, content: string) {
    setFiles((prev) => prev.map((file) => (file.path === path ? { ...file, content } : file)));
  }

  async function save(path: string) {
    const file = files.find((f) => f.path === path);
    if (!file) return;
    await writeFile(path, file.content);
    setFiles((prev) => prev.map((f) => (f.path === path ? { ...f, savedContent: f.content } : f)));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        if (activePath) save(activePath);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, files]);

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {error ?? "Selecione um arquivo no Explorer para começar."}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs value={activePath ?? undefined} onValueChange={setActivePath}>
        <TabsList className="h-auto justify-start rounded-none border-b bg-transparent p-0">
          {files.map((file) => {
            const dirty = file.content !== file.savedContent;
            return (
              <TabsTrigger
                key={file.path}
                value={file.path}
                className="group flex items-center gap-1.5 rounded-none border-r data-[state=active]:bg-muted"
              >
                <span className="max-w-[14ch] truncate">{file.path.split("/").pop()}</span>
                {dirty && <span className="h-1.5 w-1.5 rounded-full bg-current forge-accent-text" aria-label="não salvo" />}
                <span
                  role="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(file.path);
                  }}
                  className={cn("ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-border")}
                >
                  <X className="h-3 w-3" />
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {activeFile && (
        <div className="flex-1">
          <MonacoEditor
            path={activeFile.path}
            language={languageFor(activeFile.path)}
            theme="vs-dark"
            value={activeFile.content}
            onChange={(value) => updateContent(activeFile.path, value ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        </div>
      )}
    </div>
  );
}
