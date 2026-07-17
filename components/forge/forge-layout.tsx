"use client";

// Portado de forge/apps/web/src/layout/ForgeLayout.tsx (monorepo `luna`).
import Link from "next/link";
import dynamic from "next/dynamic";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Explorer } from "@/components/forge/explorer";
import { Editor } from "@/components/forge/editor";
import { Chat } from "@/components/forge/chat";
import { GitPanel } from "@/components/forge/git-panel";
import { ContextPanel } from "@/components/forge/context-panel";
import { useState } from "react";
import { ProjectProvider, useForgeProject } from "@/lib/forge/project-context";
import { KNOWN_FORGE_PROJECTS } from "@/lib/forge/memory";

// Forge MVP-03 — seletor do projeto ativo, compartilhado por todos os
// painéis via ProjectProvider (ver lib/forge/project-context.tsx).
function ProjectSelector() {
  const { project, setProject } = useForgeProject();
  return (
    <select
      value={project}
      onChange={(event) => setProject(event.target.value)}
      className="rounded border border-border bg-transparent px-1.5 py-0.5 text-xs"
      title="Projeto ativo"
    >
      {KNOWN_FORGE_PROJECTS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

// @xterm/xterm referencia globals de browser em module scope — precisa ficar
// fora da árvore renderizada no servidor, assim como o MonacoEditor em editor.tsx.
const Terminal = dynamic(() => import("@/components/forge/terminal").then((mod) => mod.Terminal), { ssr: false });

export function ForgeLayout() {
  const [activeFile, setActiveFile] = useState<string | null>(null);

  return (
    <ProjectProvider>
      <div className="flex h-screen flex-col">
        <header className="flex items-center gap-2 border-b px-3 py-1.5">
          <span className="forge-brand-glow h-2 w-2 rounded-full bg-primary" />
          <span className="text-sm font-semibold forge-accent-text">LUNA Forge</span>
          <span className="text-xs text-muted-foreground">MVP-01 · Dev Mode</span>
          <ProjectSelector />
          <Link href="/" className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            ← User Mode
          </Link>
        </header>

        <ResizablePanelGroup direction="vertical" className="flex-1">
          <ResizablePanel defaultSize={55} minSize={25}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={20} minSize={12}>
                <Explorer activePath={activeFile} onSelectFile={setActiveFile} />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={80} minSize={30}>
                <Editor openPath={activeFile} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={20} minSize={10}>
            <Chat />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={25} minSize={12}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={22} minSize={15}>
                <ContextPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={38} minSize={20}>
                <GitPanel />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={40} minSize={20}>
                <Terminal />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </ProjectProvider>
  );
}
