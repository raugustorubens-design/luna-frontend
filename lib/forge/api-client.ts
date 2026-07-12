/**
 * Único ponto de contato do Forge (Dev Mode) com o organismo LUNA. Tudo aqui é
 * HTTP contra contratos já públicos e testados — Gateway e Cognitive Engine
 * (`/api/chat`). Nenhuma lógica de banco, memória ou provider vive aqui.
 *
 * Portado de forge/apps/web/src/lib/api-client.ts (monorepo `luna`), migrado
 * do MVP-01 standalone para o luna-frontend. Única mudança de fundo: leitura
 * de env var (`import.meta.env` do Vite -> `process.env.NEXT_PUBLIC_*` do
 * Next.js). O contrato HTTP em si é idêntico.
 *
 * ATENÇÃO (ADR-004): `/gateway/*` e `/chat`/`/context` não vivem mais
 * necessariamente no mesmo backend. O Gateway foi portado para `luna-core`
 * (ver `LUNA_GATEWAY_BASE_URL` abaixo); `/chat` e `/context` continuam
 * apontando para o backend antigo (`luna-guardian`/`strong-celebration`),
 * que nunca implementou essas duas rotas corretamente (achado da auditoria
 * de Fase 1: `/chat` lá tem um contrato diferente do que este cliente
 * espera, e `/context` simplesmente não existe naquele serviço). Isso não é
 * corrigido aqui — só o Gateway estava no escopo desta mudança. Registrado
 * como lacuna aberta, não corrigida silenciosamente.
 */

/**
 * `NEXT_PUBLIC_*` env vars are inlined by Next.js at *build* time, not read
 * at runtime — setting `NEXT_PUBLIC_LUNA_API_BASE_URL` in Railway's
 * "Variables" only takes effect on the *next* build. If a production build
 * ever runs without it configured, the old unconditional
 * `?? "http://localhost:3001/api"` fallback got baked into the client
 * bundle permanently, so the deployed app called `localhost:3001` from
 * every visitor's browser (ERR_CONNECTION_REFUSED) — that's the bug this
 * fixes. The dev-only default stays localhost (correct for `pnpm run dev`
 * against a local backend); a production build with no explicit env var now
 * falls back to the real deployed backend instead of localhost.
 */
const PRODUCTION_LUNA_API_BASE_URL = "https://strong-celebration-production.up.railway.app/api";
const DEVELOPMENT_LUNA_API_BASE_URL = "http://localhost:3001/api";

const LUNA_API_BASE_URL =
  process.env.NEXT_PUBLIC_LUNA_API_BASE_URL ??
  (process.env.NODE_ENV === "production" ? PRODUCTION_LUNA_API_BASE_URL : DEVELOPMENT_LUNA_API_BASE_URL);

/**
 * O Gateway (capabilities/execute) foi portado do monorepo `luna` para
 * `luna-core` (ADR-004) — serviço `uvicorn-main` no projeto Railway
 * `honest-joy`, agora rodando Node/TypeScript em vez de Python/FastAPI. Base
 * URL separada de `LUNA_API_BASE_URL` de propósito: os dois backends não são
 * (ainda) o mesmo serviço, e apontar tudo para `luna-core` quebraria
 * `/chat`/`/context`, que `luna-core` não implementa.
 */
const PRODUCTION_LUNA_GATEWAY_BASE_URL = "https://uvicorn-main-production-92f8.up.railway.app/api";
const DEVELOPMENT_LUNA_GATEWAY_BASE_URL = "http://localhost:8080/api";

const LUNA_GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL ??
  (process.env.NODE_ENV === "production" ? PRODUCTION_LUNA_GATEWAY_BASE_URL : DEVELOPMENT_LUNA_GATEWAY_BASE_URL);

export interface CapabilityManifest {
  id: string;
  version: number;
  owner: string;
  status: "healthy" | "degraded" | "disabled";
  requiresApproval: boolean;
  supportsDryRun: boolean;
  supportsRollback: boolean;
  description: string;
}

export interface CapabilityResult<TOutput = unknown> {
  success: boolean;
  capability: string;
  version: number;
  duration: number;
  status: string;
  dryRun: boolean;
  evidence: Array<{ source: string; reference: string; observedAt: string; metadata?: Record<string, unknown> }>;
  output: TOutput | null;
  error: { code: string; message: string; details?: unknown } | null;
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("error" in body)) return fallback;
  const error = (body as { error: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return fallback;
}

/** For endpoints whose failure shape is a plain `{ error: string }` (chat, git-status, capability discovery). */
async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractErrorMessage(body, response.statusText));
  }
  return body as T;
}

/**
 * Gateway's `/gateway/execute` always returns a well-formed `CapabilityResult`
 * JSON body — including on failure (HTTP 400/404 with `success: false`, a
 * structured `error: {code, message, details}`). That is not an HTTP-level
 * failure to throw on; it's a normal response shape callers already inspect
 * via `.success`/`.error`. Parsing it as a plain `{error: string}` (like
 * `parseJsonOrThrow` does for other endpoints) turned the nested error object
 * into the literal string "[object Object]" — this returns the body as-is
 * instead.
 */
async function parseCapabilityResult<T>(response: Response): Promise<CapabilityResult<T>> {
  const body = await response.json().catch(() => null);
  if (!body) {
    throw new Error(response.statusText || "Resposta vazia do Gateway");
  }
  return body as CapabilityResult<T>;
}

export async function listCapabilities(): Promise<CapabilityManifest[]> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/gateway/capabilities`);
  const data = await parseJsonOrThrow<{ capabilities: CapabilityManifest[] }>(response);
  return data.capabilities;
}

export async function executeCapability<TOutput = unknown>(
  capability: string,
  input: unknown,
  options?: { dryRun?: boolean },
): Promise<CapabilityResult<TOutput>> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/gateway/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ capability, input, dryRun: options?.dryRun ?? false }),
  });
  return parseCapabilityResult<TOutput>(response);
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function sendChatMessage(content: string, conversationId?: string): Promise<ChatMessage> {
  const response = await fetch(`${LUNA_API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, role: "user", conversationId }),
  });
  return parseJsonOrThrow<ChatMessage>(response);
}

export interface LocalGitStatus {
  branch: string;
  lastCommit: { sha: string; message: string } | null;
}

/** Servido pela própria instância Next.js (custom server), não pelo Gateway — ver app/api/forge/git-status. */
export async function fetchLocalGitStatus(): Promise<LocalGitStatus> {
  const response = await fetch(`/api/forge/git-status`);
  return parseJsonOrThrow<LocalGitStatus>(response);
}

// ---- Context Hub (Forge MVP-02) ----

export interface OrganismContext {
  project: string;
  mission: string;
  currentMvp: string;
  architecturalState: string;
  organismState: string;
  cognitiveIndex: string[];
  checkpoints: Array<{ id?: string | number; summary: string; at?: string }>;
  inferences: string[];
  roadmap: string[];
  activeRepositories: string[];
  activeSystems: string[];
  providers: Array<{ id: string; configured: boolean }>;
}

/**
 * Único ponto de contato do Forge com o Context Hub — nunca lê
 * LUNA_CONTEXT.md (ou qualquer markdown) diretamente. `GET /api/context` é
 * uma rota irmã do Gateway no backend (mesmo padrão de `/api/chat`), não uma
 * capability — ver decisão registrada em LUNA_CONTEXT.md.
 */
export async function fetchOrganismContext(): Promise<OrganismContext> {
  const response = await fetch(`${LUNA_API_BASE_URL}/context`);
  return parseJsonOrThrow<OrganismContext>(response);
}

/**
 * `NEXT_PUBLIC_FORGE_TERMINAL_TOKEN` deve ser igual ao `FORGE_TERMINAL_TOKEN`
 * do servidor (ver server.ts) — em produção, o servidor rejeita a conexão
 * sem esse token (nenhum shell é criado). Em desenvolvimento local o
 * servidor não exige token, então isto é opcional aqui.
 */
export function terminalWebSocketUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const token = process.env.NEXT_PUBLIC_FORGE_TERMINAL_TOKEN;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${protocol}//${window.location.host}/forge/terminal${query}`;
}

// ---- Filesystem capabilities (Explorer/Editor) ----

export interface FilesystemEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
}

export async function listDirectory(path: string): Promise<FilesystemEntry[]> {
  const result = await executeCapability<{ path: string; entries: FilesystemEntry[] }>("filesystem.list", { path });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao listar diretório");
  return result.output.entries;
}

export async function readFile(path: string): Promise<string> {
  const result = await executeCapability<{ content: string }>("filesystem.read", { path, encoding: "utf8" });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao ler arquivo");
  return result.output.content;
}

export async function writeFile(path: string, content: string): Promise<void> {
  const result = await executeCapability("filesystem.write", { path, content, encoding: "utf8" });
  if (!result.success) throw new Error(result.error?.message ?? "Falha ao salvar arquivo");
}

// ---- GitHub capabilities (Git panel) ----

export interface GithubBranchSummary {
  name: string;
  sha: string;
  protected: boolean;
}

export async function listGithubBranches(owner: string, repo: string): Promise<GithubBranchSummary[]> {
  const result = await executeCapability<{ branches: GithubBranchSummary[] }>("github.list_branches", { owner, repo });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao listar branches");
  return result.output.branches;
}

export interface GithubCommitSummary {
  sha: string;
  message: string;
  author: string;
  authoredAt: string;
  htmlUrl: string;
}

export async function listGithubCommits(owner: string, repo: string, sha?: string): Promise<GithubCommitSummary[]> {
  const result = await executeCapability<{ commits: GithubCommitSummary[] }>("github.list_commits", { owner, repo, sha });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao listar commits");
  return result.output.commits;
}

export interface GithubPullRequestSummary {
  number: number;
  title: string;
  state: string;
  head: string;
  base: string;
  htmlUrl: string;
}

export async function listGithubPullRequests(owner: string, repo: string): Promise<GithubPullRequestSummary[]> {
  const result = await executeCapability<{ pullRequests: GithubPullRequestSummary[] }>("github.list_pull_requests", { owner, repo });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao listar pull requests");
  return result.output.pullRequests;
}

export interface GithubCompareResult {
  status: string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: Array<{ filename: string; status: string; additions: number; deletions: number; changes: number }>;
}

export async function compareGithubCommits(owner: string, repo: string, base: string, head: string): Promise<GithubCompareResult> {
  const result = await executeCapability<GithubCompareResult>("github.compare_commits", { owner, repo, base, head });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao comparar commits");
  return result.output;
}
