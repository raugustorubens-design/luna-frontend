/**
 * Metadado de atribuição de mensagem (Forge v0.1 § Chat, GENESIS/FORGE.md,
 * `raugustorubens-design/Luna-context.md`). Um agente ativo por vez em
 * v0.1, mas toda mensagem carrega isto mesmo assim — prepara v0.2
 * (multiagente concorrente) e v1 (rede cognitiva cooperativa) sem
 * retrabalho no modelo de dados.
 */
export const FORGE_AGENTS = ["gpt", "claude", "groq"] as const;
export type ForgeAgent = (typeof FORGE_AGENTS)[number];

export const FORGE_AGENT_LABELS: Record<ForgeAgent, string> = {
  gpt: "GPT",
  claude: "Claude",
  groq: "Groq",
};

/**
 * Modelo default exibido por agente. Rótulo de atribuição, não uma
 * garantia de qual modelo de fato responde — quem decide isso é o
 * ProviderRouter do backend (fora do escopo do Forge).
 */
export const FORGE_AGENT_DEFAULT_MODEL: Record<ForgeAgent, string> = {
  gpt: "gpt-4o",
  claude: "claude-sonnet",
  groq: "llama-3.3-70b",
};

export interface MessageAttribution {
  agent: ForgeAgent;
  model: string;
  timestamp: string;
  projectId: string;
}
