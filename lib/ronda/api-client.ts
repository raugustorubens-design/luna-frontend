import { LUNA_GATEWAY_BASE_URL } from "@/lib/forge/api-client";
import type { RondaSubmission, RondaPatch, RondaFlag, RondaSuggestion, RondaPhoto, RondaFotoSugestao, SuggestionCorrectionPayload, ValidationIssue } from "./types";

export interface RondaSubmitResult {
  rondaId: string;
  titulo: string;
  data: string;
  local: string;
  achadosCount: number;
  createdAt: string;
}

export class RondaSubmitError extends Error {
  readonly issues?: ValidationIssue[];
  /** Status HTTP da resposta que gerou o erro — usado pela fila (queue.ts) pra distinguir rejeição definitiva do servidor (422, validação) de falha transiente (rede, 5xx), que continuam elegíveis a reenvio automático. */
  readonly status?: number;
  constructor(message: string, issues?: ValidationIssue[], status?: number) {
    super(message);
    this.name = "RondaSubmitError";
    this.issues = issues;
    this.status = status;
  }
}

/** POST /convergia/ronda (luna-core, ADR-021 Fase 1). Lança RondaSubmitError em qualquer falha (rede ou validação) — a fila (lib/ronda/queue.ts) é quem decide o que fazer com o erro (reter e reenviar depois). */
export async function submitRonda(submission: RondaSubmission): Promise<RondaSubmitResult> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao enviar ronda (HTTP ${response.status}).`, body?.issues, response.status);
  }

  const body = await response.json();
  return body.ronda as RondaSubmitResult;
}

/** `GET /convergia/ronda/flags` — catálogo de flags (Decisão 2 da revisão de arquitetura), ordenado pra exibição na Etapa B. */
export async function getFlags(): Promise<RondaFlag[]> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/flags`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao carregar o catálogo de flags (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.flags as RondaFlag[];
}

/**
 * `GET /convergia/ronda/sugestoes?flagId=` — sugestões reais pra um flag,
 * consulta determinística a `controle_risco` (nenhuma IA/chat envolvida).
 * Lista vazia é uma resposta válida (flag sem `bibliotecaRiscoId`, como
 * `passivo_trabalhista`, ou sem controle cadastrado) — o chamador mostra só
 * o "+" manual nesse caso.
 */
export async function getSugestoes(flagId: string): Promise<RondaSuggestion[]> {
  const url = new URL(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/sugestoes`);
  url.searchParams.set("flagId", flagId);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao carregar sugestões (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.sugestoes as RondaSuggestion[];
}

/**
 * `POST /convergia/ronda/foto-sugestao` (Decisão 2, segunda fonte de
 * sugestão — Fase 4 do ADR-021 original) — sempre devolve `null` em vez de
 * lançar quando o backend não conseguiu gerar sugestão (rede, rate limit,
 * resposta malformada — falha silenciosa por decisão do Architect, mesma
 * política do lado do servidor). Anexar foto nunca fica bloqueado
 * esperando isto.
 */
export async function getFotoSugestao(photo: RondaPhoto): Promise<RondaFotoSugestao | null> {
  try {
    const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/foto-sugestao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(photo),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return (body.sugestao as RondaFotoSugestao | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * `POST /convergia/ronda/correcao-sugestao` (Decisão 3, correção humana
 * vira aprendizado) — best-effort puro, chamado depois que a ronda já foi
 * salva/enfileirada com sucesso: nunca lança, uma falha aqui não deve
 * incomodar o usuário nem reverter o envio da ronda, que já aconteceu.
 */
export async function postCorrecaoSugestao(payload: SuggestionCorrectionPayload): Promise<void> {
  try {
    await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/correcao-sugestao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort — ver nota acima
  }
}

/** Ronda completa, como devolvida por `GET /convergia/ronda/:id` (usada pela tela de edição — a mesma UI de achados do wizard precisa do objeto inteiro, não só o resumo de `RondaSubmitResult`). */
export type RondaDetail = RondaSubmission & { createdAt: string };

/** `GET /convergia/ronda` (luna-core, ADR-021 Fase 1/CONV-013) — lista de rondas já enviadas, mais recentes primeiro. Usado pela tela "Ver rondas anteriores" (extensão da Fase 1). */
export async function listRondas(limit?: number): Promise<RondaSubmitResult[]> {
  const url = new URL(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda`);
  if (limit) url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao listar rondas (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.rondas as RondaSubmitResult[];
}

/** `GET /convergia/ronda/:id` — ronda completa (metadata + achados + encerramento), para abrir na tela de edição. */
export async function getRonda(rondaId: string): Promise<RondaDetail> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/${encodeURIComponent(rondaId)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao carregar a ronda (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.ronda as RondaDetail;
}

/**
 * `PATCH /convergia/ronda/:id` (luna-core, extensão da Fase 1/CONV-013) —
 * edição de uma ronda já enviada: adicionar/remover/editar achado (por
 * categoria, ver `RondaPatch`) e/ou editar a observação geral. O backend
 * mescla com a ronda salva e revalida com a mesma regra da criação — um 422
 * aqui significa que a edição deixaria a ronda num estado inválido (ex.
 * campo obrigatório faltando num achado identificado), não um bug do
 * cliente.
 */
export async function patchRonda(rondaId: string, patch: RondaPatch): Promise<RondaSubmitResult> {
  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/${encodeURIComponent(rondaId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao editar a ronda (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.ronda as RondaSubmitResult;
}

/**
 * `POST /convergia/ronda/foto` (Camada 2, decisão de campo 16/08/2026) — a
 * foto sobe sozinha, no momento em que é tirada, e o relatório carrega só o
 * id dela.
 *
 * Multipart, não JSON: base64 infla 33% no fio, e é justamente esse custo
 * que impede a original de caber no payload de 25 MB do relatório. A
 * original é opcional — em rede ruim, sobe só a versão de campo, que é a que
 * o relatório usa, e nada se perde no documento final.
 */
export async function uploadFoto(campo: Blob, original?: Blob, achadoId?: string): Promise<{ fotoId: string }> {
  const form = new FormData();
  form.set("campo", campo, "campo.jpg");
  if (original) form.set("original", original, "original.jpg");
  if (achadoId) form.set("achadoId", achadoId);

  const response = await fetch(`${LUNA_GATEWAY_BASE_URL}/convergia/ronda/foto`, { method: "POST", body: form });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new RondaSubmitError(body?.error ?? `Falha ao enviar a foto (HTTP ${response.status}).`, body?.issues, response.status);
  }
  const body = await response.json();
  return { fotoId: body.fotoId as string };
}

/** URL de exibição de uma foto já no servidor. `versao: "original"` pede o arquivo como saiu da câmera; o default é a versão de campo, que é a que o relatório mostra. */
export function rondaFotoUrl(fotoId: string, versao?: "original"): string {
  return `${LUNA_GATEWAY_BASE_URL}/convergia/ronda/foto/${encodeURIComponent(fotoId)}${versao === "original" ? "?versao=original" : ""}`;
}
