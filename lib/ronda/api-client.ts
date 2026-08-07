import { LUNA_GATEWAY_BASE_URL } from "@/lib/forge/api-client";
import type { RondaSubmission } from "./types";

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
