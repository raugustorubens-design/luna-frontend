"use client";

// Forge MVP-03 — Projetos com contexto próprio. v0.1 mínimo: um projeto
// ativo por vez, compartilhado por todos os painéis do Forge (Chat hoje;
// qualquer painel futuro que precise de `project`/`projectId` consome daqui
// em vez de reinventar seu próprio default). Substitui o DEFAULT_PROJECT_ID
// fixo que existia em chat.tsx antes deste MVP.
import { createContext, useContext, useState, type ReactNode } from "react";
import { KNOWN_FORGE_PROJECTS } from "./memory";

interface ProjectContextValue {
  project: string;
  setProject: (project: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<string>(KNOWN_FORGE_PROJECTS[0]);
  return <ProjectContext.Provider value={{ project, setProject }}>{children}</ProjectContext.Provider>;
}

export function useForgeProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useForgeProject must be used within a ProjectProvider");
  return ctx;
}
