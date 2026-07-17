/**
 * Execution Metadata (Forge v0.1) — GENESIS/FORGE.md, seção "Execution
 * Metadata", `raugustorubens-design/Luna-context.md`. Suficiente para
 * executar (de onde um item de memória saiu), não a Operational Memory
 * Layer completa (MEM-001, congelada por ARCH-001) — não adicionar campos
 * de Semantic Layer/Score/τ aqui.
 */
export interface ExecutionMetadata {
  repository: string;
  branch: string;
  path: string;
  commit: string;
  owner: string;
}

/**
 * Lista conhecida por FORGE-MVP-03 (Projetos com contexto próprio). O
 * schema em si aceita qualquer string de projeto (ver "..." na
 * especificação) — esta constante é só a lista usada pelo seletor de UI.
 */
export const KNOWN_FORGE_PROJECTS = ["LUNA", "RENASCER", "SMX", "CURSO EMPILHADEIRA"] as const;
export type KnownForgeProject = (typeof KNOWN_FORGE_PROJECTS)[number];

export interface MemoryItem {
  id: string;
  content: string;
  execution_metadata: ExecutionMetadata;
  project: string;
  saved_at: string;
}

export interface CreateMemoryItemInput {
  content: string;
  project: string;
  execution_metadata: ExecutionMetadata;
  id?: string;
  saved_at?: string;
}

/** Monta um MemoryItem completo, gerando id/saved_at quando não fornecidos. */
export function createMemoryItem(input: CreateMemoryItemInput): MemoryItem {
  return {
    id: input.id ?? crypto.randomUUID(),
    content: input.content,
    execution_metadata: input.execution_metadata,
    project: input.project,
    saved_at: input.saved_at ?? new Date().toISOString(),
  };
}
