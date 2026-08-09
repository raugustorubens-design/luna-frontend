import { LUNA_GATEWAY_BASE_URL } from "@/lib/forge/api-client";
import type { RondaSubmission, RondaPatch } from "./types";

export interface RondaSubmitResult {
  rondaId: string;
  titulo: string;
  data: string;
  local: string;
  achadosCount: number;
  createdAt: string;
}

export class RondaSubmitError extends Error {
  readonly issues?: { path: string; message: string }[];
  constructor(message: string, issues?: { path: string; message: string }[]) {
    super(message);
    this.name = "RondaSubmitError";
    this.issues = issues;
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
    throw new RondaSubmitError(body?.error ?? `Falha ao enviar ronda (HTTP ${response.status}).`, body?.issues);
  }

  const body = await response.json();
  return body.ronda as RondaSubmitResult;
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
