"use client";

import { useEffect, useMemo, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ProjectProvider } from "@/lib/forge/project-context";
import { SiteThemeProvider } from "@/components/theme/site-theme-provider";
import { useSiteTheme } from "@/components/theme/site-theme-provider";
import { CommandBar } from "@/components/forge/command-bar";
import { CommandPalette, type ForgeCommand } from "@/components/forge/command-palette";
import { ActivityRail, type RailTarget } from "@/components/forge/activity-rail";
import { SidePanel } from "@/components/forge/side-panel";
import { Editor } from "@/components/forge/editor";
import { ChatColumn } from "@/components/forge/chat-column";
import { ConvergiaPanel } from "@/components/forge/convergia-panel";
import { BottomDrawer } from "@/components/forge/bottom-drawer";
import { StatusBar } from "@/components/forge/status-bar";

interface ForgeLayoutV2Props {
  initialTab?: "workspace" | "convergia";
}

const RAIL_LABEL: Record<RailTarget, string> = {
  files: "Arquivos",
  git: "Versionamento",
  context: "Memória e contexto",
  convergia: "Convergia",
};

/** Termos de busca da paleta de comandos para cada alvo da trilha — a
 *  palavra que a pessoa digita nem sempre é a que está no rótulo (ex.
 *  "git" para "Versionamento"). */
const RAIL_KEYWORDS: Record<RailTarget, string[]> = {
  files: ["explorer", "arquivo"],
  git: ["git", "branch", "commit", "push", "pull"],
  context: ["memória", "memoria", "contexto", "adr"],
  convergia: ["documento", "relatório", "relatorio", "upload"],
};

/**
 * ADR-022, etapa 4 — Forge v2.
 *
 * Layout NOVO, ao lado do antigo. `forge-layout.tsx` não é alterado — é ele
 * que continua abrindo em `/forge`. Este só entra por `/forge?layout=v2`
 * (ver `app/forge/page.tsx`). Os dois convivem no mesmo bundle de propósito:
 * é o custo aceito de poder voltar em um clique até o Arquiteto aprovar o
 * novo em produção.
 *
 * O que muda de verdade: o Chat sai da faixa horizontal de 20% de altura e
 * ganha coluna própria (`ChatColumn`); a trilha lateral (`ActivityRail`)
 * substitui a pilha de painéis por um alvo por vez; ganha barra de comandos
 * (`CommandBar` + `CommandPalette`, ⌘K) e barra de estado (`StatusBar`) —
 * nenhuma das duas existia antes. Todo o resto — `Explorer`, `Editor`,
 * `Chat`, `GitPanel`, `ContextPanel`, `Terminal`, `ClaudeCodePanel`,
 * `ConvergiaPanel` — é reusado sem alteração de assinatura.
 */
export function ForgeLayoutV2({ initialTab = "workspace" }: ForgeLayoutV2Props) {
  const [rail, setRail] = useState<RailTarget>(initialTab === "convergia" ? "convergia" : "files");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K abre a paleta de qualquer lugar da tela — inclusive com o
  // foco dentro do Monaco ou do terminal, por isso o listener é global
  // (`document`, não um elemento específico) e não em um input de busca.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SiteThemeProvider>
      <ProjectProvider>
        <ForgeBody
          rail={rail}
          setRail={setRail}
          activeFile={activeFile}
          setActiveFile={setActiveFile}
          paletteOpen={paletteOpen}
          setPaletteOpen={setPaletteOpen}
        />
      </ProjectProvider>
    </SiteThemeProvider>
  );
}

/**
 * Componente interno só para poder chamar `useSiteTheme()` — o hook exige um
 * `SiteThemeProvider` acima dele na árvore, e `ForgeLayoutV2` é quem monta
 * esse provider.
 */
function ForgeBody({
  rail,
  setRail,
  activeFile,
  setActiveFile,
  paletteOpen,
  setPaletteOpen,
}: {
  rail: RailTarget;
  setRail: (target: RailTarget) => void;
  activeFile: string | null;
  setActiveFile: (path: string | null) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
}) {
  const { toggleTheme } = useSiteTheme();

  const commands: ForgeCommand[] = useMemo(
    () => [
      ...(Object.keys(RAIL_LABEL) as RailTarget[]).map((target) => ({
        id: `rail:${target}`,
        label: `Ir para ${RAIL_LABEL[target]}`,
        keywords: RAIL_KEYWORDS[target],
        hint: target === rail ? "atual" : undefined,
        run: () => setRail(target),
      })),
      {
        id: "theme:toggle",
        label: "Alternar tema claro/escuro",
        keywords: ["tema", "claro", "escuro", "dark", "light"],
        run: toggleTheme,
      },
    ],
    [rail, setRail, toggleTheme],
  );

  return (
    <div className="luna-v2 flex h-screen flex-col bg-[var(--luna-bg)] text-[length:var(--luna-step--1)] text-[var(--luna-text)]">
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />

      <CommandBar onOpenPalette={() => setPaletteOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <ActivityRail value={rail} onChange={setRail} />

        {rail === "convergia" ? (
          // Convergia toma a área central inteira, mesmo comportamento que
          // já tinha como aba própria no layout antigo — não é um painel
          // lateral, é o alvo inteiro trocando de conteúdo.
          <div className="min-w-0 flex-1">
            <ConvergiaPanel />
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize={18} minSize={14} maxSize={32}>
              <SidePanel target={rail} activePath={activeFile} onSelectFile={setActiveFile} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={58} minSize={30}>
              <Editor openPath={activeFile} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={24} minSize={18}>
              <ChatColumn />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      <BottomDrawer />
      <StatusBar />
    </div>
  );
}
