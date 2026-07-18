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
 * ATUALIZADO (ADR-012): a lacuna que este comentário descrevia foi fechada.
 * `/chat`/`/context` foram portados do monorepo `luna` para `luna-core`
 * (mesmo backend do Gateway) — o contrato incompatível de `luna-guardian`/
 * `strong-celebration` foi descontinuado junto (rotas removidas de lá).
 * `LUNA_API_BASE_URL` deixou de existir como base separada: `sendChatMessage`/
 * `fetchOrganismContext` agora usam `LUNA_GATEWAY_BASE_URL`, a mesma base de
 * `listCapabilities`/`executeCapability`.
 */

import type { MemoryItem } from "./memory";

/**
 * O Gateway, o Cognitive Engine (`/chat`, `/context`) e o Convergia
 * (`/convergia/*`) vivem todos em `luna-core` desde o ADR-012 — serviço
 * `uvicorn-main` no projeto Railway `honest-joy`. Uma única base URL para
 * os três, ao contrário de antes (ADR-004 só tinha portado o Gateway;
 * `/chat`/`/context` continuavam num backend separado e desatualizado).
 *
 * `NEXT_PUBLIC_*` env vars são inlined pelo Next.js em *build* time, não
 * lidas em runtime — configurar `NEXT_PUBLIC_LUNA_GATEWAY_BASE_URL` no
 * Railway só tem efeito no *próximo* build.
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

/**
 * `agent`/`model` (Forge MVP-02, seletor de agente) são enviados junto do
 * corpo como metadado de atribuição — aditivo, não muda o contrato
 * existente. Quem decide de fato qual provider responde continua sendo o
 * ProviderRouter do backend; isto não força roteamento, só rotula a
 * intenção do desenvolvedor no momento do envio.
 */
export async function sendChatMessage(
  content: string,
  conversationId?: string,
  attribution?: { agent: string; model: string },
): Promise<ChatMessage> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, role: "user", conversationId, agent: attribution?.agent, model: attribution?.model }),
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

// ---- Git write actions (Forge MVP-06) ----
//
// Assim como fetchLocalGitStatus acima, estas rotas rodam no próprio
// servidor do Forge (nunca via GitHub API/Gateway) e usam a credencial de
// serviço já configurada nesse ambiente — independente de qual agente
// (GPT/Claude/Groq) está ativo no Chat (Forge MVP-02).

export interface GitCommitResult {
  committed: boolean;
  sha: string | null;
  message: string;
}

export async function commitLocalChanges(message: string): Promise<GitCommitResult> {
  const response = await fetch(`/api/forge/git-commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return parseJsonOrThrow<GitCommitResult>(response);
}

export interface GitPushResult {
  branch: string;
  output: string;
}

export async function pushLocalBranch(): Promise<GitPushResult> {
  const response = await fetch(`/api/forge/git-push`, { method: "POST" });
  return parseJsonOrThrow<GitPushResult>(response);
}

export interface GitPullResult {
  branch: string;
  output: string;
}

export async function pullLocalBranch(): Promise<GitPullResult> {
  const response = await fetch(`/api/forge/git-pull`, { method: "POST" });
  return parseJsonOrThrow<GitPullResult>(response);
}

export async function createGitBranch(name: string): Promise<LocalGitStatus> {
  const response = await fetch(`/api/forge/git-branch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
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
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/context`);
  return parseJsonOrThrow<OrganismContext>(response);
}

// ---- Guardian Memory Index (via Gateway) ----
//
// Distinto do Context Hub acima: não substitui `fetchOrganismContext`/
// `/context` (que continua indisponível, lacuna já registrada) — consome a
// nova capability `guardian.memory_index_search`, exposta pelo Gateway
// (`luna-core`), que por sua vez fala com a Memory Index do Guardian
// (`luna-guardian`, `GET /guardian/memory/index-search`). Nunca acessa o
// Guardian diretamente — sempre via Gateway (ADR-002).

export interface GuardianMemoryImpressaoCognitiva {
  id: string;
  tipo: string;
  resumo: string;
  camada: number;
  estado: string;
  criadoEm: string;
  ref: { collection: string; id: string };
}

export interface GuardianMemoryIndexSearchResult {
  resultados: GuardianMemoryImpressaoCognitiva[];
  suficiente: boolean;
  motivo: string;
}

export async function searchGuardianMemoryIndex(params?: { tipo?: string; q?: string; limit?: number }): Promise<GuardianMemoryIndexSearchResult> {
  const result = await executeCapability<GuardianMemoryIndexSearchResult>("guardian.memory_index_search", params ?? {});
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao consultar a Memory Index do Guardian");
  return result.output;
}

// ---- Storage Contract (Forge MVP-04) ----
//
// Forge → Guardian (Memory Service) → Storage Contract → adapter de banco
// (GENESIS/FORGE.md § Storage Contract, `raugustorubens-design/Luna-context.md`).
// O Forge fala só com o Guardian, via Gateway — nunca com o Storage
// Contract nem o adapter de banco diretamente, mesmo padrão de
// searchGuardianMemoryIndex acima. Guardian nunca conhece qual banco está
// por trás do Storage Contract; trocar de banco no futuro não muda nenhum
// chamador daqui (nem este arquivo precisa nomear o banco atual — ver
// constitution-check.mjs, que bloqueia esse token de propósito).

export interface MemoryQuery {
  project?: string;
  q?: string;
  limit?: number;
}

export async function persistMemory(item: MemoryItem): Promise<MemoryItem> {
  const result = await executeCapability<MemoryItem>("guardian.persist_memory", item);
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao persistir memória via Guardian");
  return result.output;
}

export async function retrieveMemory(query: MemoryQuery = {}): Promise<MemoryItem[]> {
  const result = await executeCapability<{ items: MemoryItem[] }>("guardian.retrieve_memory", query);
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao consultar memória via Guardian");
  return result.output.items;
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

/**
 * `github.read_file` — capability madura e testada no Gateway (ver
 * apps/frontend/artifacts/api-server/src/gateway/capabilities/github/
 * read-file.ts no monorepo `luna`), diferente de `guardian.*`/
 * `reporter.*` acima (cujo status real no backend não foi confirmado
 * nesta sessão). Usada pelo painel Claude Code (Forge MVP-08) para ler
 * GENESIS/BUILDER.md do ecossistema.
 */
export interface GithubFileContent {
  owner: string;
  repo: string;
  path: string;
  ref: string;
  sha: string;
  content: string;
  size: number;
  htmlUrl: string;
}

export async function readGithubFile(owner: string, repo: string, path: string): Promise<GithubFileContent> {
  const result = await executeCapability<GithubFileContent>("github.read_file", { owner, repo, path });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao ler arquivo do GitHub");
  return result.output;
}

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

// ---- Reporter manual (Forge MVP-07) ----
//
// "Analisar Projeto" — mesmo escopo de ENG-007 (GENESIS/ENGINEER.md,
// `raugustorubens-design/Luna-context.md`): o Reporter verifica por
// evidência, nunca cria ou reprioriza item de Roadmap/Framework. Este
// cliente só chama a capability e exibe o resultado — nenhuma ação de
// escrita no Roadmap acontece a partir daqui. Distinto do Reporter
// automático (congelado por ARCH-001) — este é sempre disparado
// manualmente pelo botão.

export interface ReporterAnalysis {
  pendencias: string[];
  concluido: string[];
  roadmap: string[];
  drift: string[];
}

export async function analyzeProject(project: string): Promise<ReporterAnalysis> {
  const result = await executeCapability<ReporterAnalysis>("reporter.analyze_project", { project });
  if (!result.success || !result.output) throw new Error(result.error?.message ?? "Falha ao analisar o projeto via Reporter");
  return result.output;
}

// ---- Convergia (ADR-012 Decisão 2) ----
//
// Fluxo: upload de arquivo -> catálogo -> upload de treinamento/conhecimento
// -> transformação. `/convergia/*` são rotas irmãs do Gateway em luna-core
// (mesmo padrão de /api/chat, /api/context, portadas juntas pelo ADR-012)
// — não são capabilities, por isso não passam por executeCapability.

export interface ConvergiaCatalogEntry {
  id: string;
  label: string;
  category: "ssma" | "gerencial" | "apresentacao";
}

export async function fetchConvergiaCatalog(): Promise<ConvergiaCatalogEntry[]> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/catalog`);
  const data = await parseJsonOrThrow<{ documents: ConvergiaCatalogEntry[] }>(response);
  return data.documents;
}

export interface ConvergiaTemplateVariable {
  name: string;
  required: boolean;
  description: string;
}

export interface ConvergiaTemplateSummary {
  id: string;
  version: number;
  type: "tabular_report" | "certificate" | "procedure" | "presentation";
  renderer: "csv" | "json" | "markdown" | "html" | "xlsx" | "pptx";
  variables: ConvergiaTemplateVariable[];
  metadata: {
    owner: string;
    category: string;
    description: string;
    regulatoryStatus: "validated" | "pending_specialist_review" | "not_applicable";
  };
}

/** `layout` (função) do TemplateDescriptor não sobrevive à serialização JSON — nunca chega aqui. */
export async function fetchConvergiaTemplates(): Promise<ConvergiaTemplateSummary[]> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/templates`);
  const data = await parseJsonOrThrow<{ templates: ConvergiaTemplateSummary[] }>(response);
  return data.templates;
}

export interface CanonicalField {
  name: string;
  value: string | number | boolean | null;
}

export interface CanonicalRecord {
  fields: CanonicalField[];
}

export interface CanonicalDocument {
  title: string;
  columns: string[];
  records: CanonicalRecord[];
  metadata: {
    sourceFormat: "xlsx" | "csv" | "json";
    sourceName: string;
    parsedAt: string;
    recordCount: number;
  };
}

export interface ConvergiaValidationIssue {
  path: string;
  message: string;
}

export interface ConvergiaValidationResult {
  valid: boolean;
  issues: ConvergiaValidationIssue[];
}

export interface ConvergiaParseResult {
  document: CanonicalDocument;
  validation: ConvergiaValidationResult;
  warnings: string[];
}

/** Etapa 1 do fluxo — upload de arquivo (xlsx/csv/json), parse + validação apenas, sem renderizar nada. */
export async function parseConvergiaFile(file: File, format?: string): Promise<ConvergiaParseResult> {
  const body = new FormData();
  body.append("file", file);
  if (format) body.append("format", format);
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/parse`, { method: "POST", body });
  return parseJsonOrThrow<ConvergiaParseResult>(response);
}

export interface ConvergiaTransformParams {
  file: File;
  format?: string;
  templateId: string;
  templateVersion?: number;
  transformId?: string;
  persistAsKnowledge?: boolean;
  knowledgeType?: "semantica" | "procedimental" | "inferencial";
}

export interface ConvergiaTransformResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  warnings: string[];
}

/** Etapa 4 do fluxo — transformação final. Sucesso não é JSON (é o arquivo renderizado), por isso não usa parseJsonOrThrow. */
export async function transformConvergiaFile(params: ConvergiaTransformParams): Promise<ConvergiaTransformResult> {
  const body = new FormData();
  body.append("file", params.file);
  if (params.format) body.append("format", params.format);
  body.append("templateId", params.templateId);
  if (params.templateVersion !== undefined) body.append("templateVersion", String(params.templateVersion));
  if (params.transformId) body.append("transformId", params.transformId);
  if (params.persistAsKnowledge) body.append("persistAsKnowledge", "true");
  if (params.knowledgeType) body.append("knowledgeType", params.knowledgeType);

  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/transform`, { method: "POST", body });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(extractErrorMessage(errorBody, response.statusText));
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const warningsHeader = response.headers.get("X-Convergia-Warnings");

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? "documento-convergia",
    mimeType: response.headers.get("Content-Type") ?? "application/octet-stream",
    warnings: warningsHeader ? (JSON.parse(warningsHeader) as string[]) : [],
  };
}

export interface ConvergiaTrainingExtraction {
  concepts: string[];
  procedures: string[];
  relations: Array<{ from: string; to: string; type: "co_occurs_with" }>;
  compactedSummary: string;
  inferences: string[];
}

export interface ConvergiaConsolidationDecision {
  action: "consolidate" | "discard";
  reason: string;
}

export interface ConvergiaTrainingResult {
  extraction: ConvergiaTrainingExtraction;
  decisions: {
    semantica?: ConvergiaConsolidationDecision;
    procedimental?: ConvergiaConsolidationDecision;
    inferencial?: ConvergiaConsolidationDecision;
  };
}

/** Etapa 3 do fluxo — upload de treinamento/conhecimento em texto (não é upload de arquivo binário). */
export async function submitConvergiaTraining(title: string, content: string): Promise<ConvergiaTrainingResult> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/training`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  return parseJsonOrThrow<ConvergiaTrainingResult>(response);
}
