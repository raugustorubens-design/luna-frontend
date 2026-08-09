/**
 * Espelha `luna-core/src/convergia/ronda/contracts.ts` (ADR-021 Fase 1) —
 * mesmo modelo canônico "metadata + achados[] + encerramento", mesmas 7
 * categorias de risco reais do relatório de referência da Manserv (ADR-021
 * Decisão 8), mesmo seletor de estado de 3 opções (Decisão 1). Cópia
 * deliberada, não import cross-repo (luna-frontend e luna-core são
 * deploys/repositórios separados, sem pacote compartilhado hoje) — mudar um
 * lado exige lembrar de espelhar no outro; se os dois derivarem, o
 * `RondaValidationError` do backend é quem detecta a divergência primeiro
 * (`POST /convergia/ronda` valida de novo, nunca confia no shape do
 * cliente).
 */

export const RISK_CATEGORIES = [
  "trabalho_em_altura",
  "espaco_confinado",
  "energia_perigosa_loto",
  "eletricidade",
  "inflamaveis_atmosfera_explosiva",
  "movimentacao_de_cargas",
  "maquinas_e_equipamentos",
] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  trabalho_em_altura: "Trabalho em Altura",
  espaco_confinado: "Espaço Confinado",
  energia_perigosa_loto: "Energia Perigosa / LOTO",
  eletricidade: "Eletricidade",
  inflamaveis_atmosfera_explosiva: "Inflamáveis / Atmosfera Explosiva",
  movimentacao_de_cargas: "Movimentação de Cargas",
  maquinas_e_equipamentos: "Máquinas e Equipamentos",
};

export const RISK_STATES = ["nao_avaliado", "identificado", "inexistente"] as const;
export type RiskState = (typeof RISK_STATES)[number];

export const RISK_STATE_LABELS: Record<RiskState, string> = {
  nao_avaliado: "Não avaliado",
  identificado: "Risco identificado",
  inexistente: "Considerado inexistente",
};

export const FINDING_CLASSIFICATIONS = ["positivo", "atencao", "nao_conformidade"] as const;
export type FindingClassification = (typeof FINDING_CLASSIFICATIONS)[number];

export const FINDING_CLASSIFICATION_LABELS: Record<FindingClassification, string> = {
  positivo: "Positivo",
  atencao: "Atenção",
  nao_conformidade: "Não Conformidade",
};

export const FINDING_SEVERITIES = ["baixa", "media", "alta", "critica"] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export interface RondaPhoto {
  /** Base64, sem prefixo `data:` — mesmo padrão do backend (`convergia_visual_templates`). */
  dataBase64: string;
  mimeType: string;
}

export interface RondaMetadata {
  titulo: string;
  data: string;
  local: string;
  responsavel: string;
  turno: string;
}

export interface RondaFinding {
  categoria: RiskCategory;
  estado: RiskState;
  departamento?: string;
  fotos?: RondaPhoto[];
  classificacao?: FindingClassification;
  gravidade?: FindingSeverity;
  descricao?: string;
  acaoRecomendada?: string;
  responsavel?: string;
  prazo?: string;
}

export interface RondaClosing {
  observacoesGerais?: string;
  incluirGraficoResumo: boolean;
}

export interface RondaSubmission {
  metadata: RondaMetadata;
  achados: RondaFinding[];
  encerramento: RondaClosing;
}

/**
 * Espelha `luna-core/src/convergia/ronda/contracts.ts` (`RondaPatch`) —
 * corpo de `PATCH /convergia/ronda/:id` (extensão da Fase 1, CONV-013, não
 * fase nova). `achados`, quando presente, é a lista de achados a substituir
 * na ronda existente, um por `categoria` (cada ronda cobre as 7 categorias
 * exatamente uma vez — `categoria` é o "id" natural do achado, não há
 * índice de array estável). "Adicionar achado" = enviar a categoria com
 * `estado: "identificado"`; "remover achado" = reenviar a mesma categoria
 * com `estado: "nao_avaliado"`/`"inexistente"` (mesmo efeito de
 * `FindingCard.setEstado` no wizard original). `encerramento` faz merge
 * raso sobre o que já está salvo.
 */
export interface RondaPatch {
  achados?: RondaFinding[];
  encerramento?: Partial<RondaClosing>;
}

/** Uma entrada nova (rascunho em andamento) — Bloco A ainda incompleto é permitido enquanto o wizard está sendo preenchido; só a submissão final exige tudo. */
export function emptyMetadata(): RondaMetadata {
  return { titulo: "", data: new Date().toISOString().slice(0, 10), local: "", responsavel: "", turno: "" };
}

export function emptyFindings(): RondaFinding[] {
  return RISK_CATEGORIES.map((categoria) => ({ categoria, estado: "nao_avaliado" }));
}

export function emptyClosing(): RondaClosing {
  return { observacoesGerais: "", incluirGraficoResumo: false };
}

/** Bloco A: os 5 campos são todos obrigatórios para avançar pro wizard — mesmo gate usado por RondaWizard, extraído aqui pra ser testável sem DOM. */
export function metadataComplete(metadata: RondaMetadata): boolean {
  return Boolean(metadata.titulo.trim() && metadata.data.trim() && metadata.local.trim() && metadata.responsavel.trim() && metadata.turno.trim());
}

/** Categorias ainda "não avaliado" — usado tanto para desenhar a lista de pendências quanto para travar o botão "Concluir ronda" (ADR-021: "não avaliado bloqueia conclusão"). */
export function pendingCategories(findings: RondaFinding[]): RondaFinding[] {
  return findings.filter((finding) => finding.estado === "nao_avaliado");
}
