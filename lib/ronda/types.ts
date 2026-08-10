/**
 * Espelha `luna-core/src/convergia/ronda/contracts.ts` (ADR-021 Fase 1 +
 * revisão de arquitetura de achado dinâmico, Decisões 1-2). Cópia
 * deliberada, não import cross-repo (luna-frontend e luna-core são
 * deploys/repositórios separados, sem pacote compartilhado hoje) — mudar um
 * lado exige lembrar de espelhar no outro; se os dois derivarem, o
 * `RondaValidationError` do backend é quem detecta a divergência primeiro
 * (`POST /convergia/ronda` valida de novo, nunca confia no shape do
 * cliente).
 */

/** As 7 flags de risco reais do relatório de referência da Manserv (ADR-021, Decisão 8). Mesmos nomes que `convergia_ronda_flags.nome` no catálogo — usado só como fallback de rótulo antes do catálogo carregar. */
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

/** Rótulos legíveis pros 8 flags desta rodada (7 categorias + passivo trabalhista) — o catálogo real (`GET /convergia/ronda/flags`) só devolve `nome` (slug), o rótulo de exibição fica só no cliente, mesma convenção de `RISK_STATE_LABELS` abaixo. */
export const FLAG_LABELS: Record<string, string> = {
  trabalho_em_altura: "Trabalho em Altura",
  espaco_confinado: "Espaço Confinado",
  energia_perigosa_loto: "Energia Perigosa / LOTO",
  eletricidade: "Eletricidade",
  inflamaveis_atmosfera_explosiva: "Inflamáveis / Atmosfera Explosiva",
  movimentacao_de_cargas: "Movimentação de Cargas",
  maquinas_e_equipamentos: "Máquinas e Equipamentos",
  passivo_trabalhista: "Passivo Trabalhista",
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
  /** Identificador próprio do achado (gerado no cliente) — substitui `categoria` como chave de endereçamento, ver `RondaPatch`. */
  id: string;
  /** Flag do catálogo (`RondaFlag.nome`) que originou a sugestão que virou este achado — `null`/ausente para achado manual, sem sugestão por trás. */
  flagId?: string | null;
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

/** Catálogo de flags (`GET /convergia/ronda/flags`) — Decisão 2 da revisão de arquitetura. */
export interface RondaFlag {
  nome: string;
  bibliotecaRiscoId: number | null;
  tipo: "risco" | "procedimento" | "5s";
  ordemExibicao: number;
}

/** Uma sugestão real (`GET /convergia/ronda/sugestoes?flagId=`) — nunca gerada por IA/chat nesta rodada. */
export interface RondaSuggestion {
  controleRiscoId: number;
  tipoControle: string;
  descricao: string;
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
 * fase nova). `achados`, quando presente, é a lista de achados endereçados
 * por `id` (achado dinâmico, ver nota no topo do arquivo): `id` já
 * existente substitui aquele achado por inteiro; `id` novo é adicionado à
 * lista — é assim que "+" pra repetir/duplicar chegam ao servidor, sem
 * endpoint separado. `encerramento` faz merge raso sobre o que já está
 * salvo.
 */
export interface RondaPatch {
  achados?: RondaFinding[];
  encerramento?: Partial<RondaClosing>;
}

function newFindingId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `finding_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Uma entrada nova (rascunho em andamento) — Bloco A ainda incompleto é permitido enquanto o wizard está sendo preenchido; só a submissão final exige tudo. */
export function emptyMetadata(): RondaMetadata {
  return { titulo: "", data: new Date().toISOString().slice(0, 10), local: "", responsavel: "", turno: "" };
}

/** Achado dinâmico: a ronda começa sem nenhum achado — cada um nasce de um "+" (sugestão ou manual), não de um slot fixo por categoria. */
export function emptyFindings(): RondaFinding[] {
  return [];
}

/** Novo achado a partir de um "+" — sempre abre já como `identificado` (é isso que o "+" significa: a pessoa decidiu registrar algo), pré-preenchido com o que vier de `overrides` (ex. `descricao` de uma sugestão). */
export function newFinding(flagId: string | null, overrides: Partial<RondaFinding> = {}): RondaFinding {
  return { id: newFindingId(), flagId, estado: "identificado", ...overrides };
}

/** Cópia de um achado já preenchido, pra "+" duplicar (Decisão 3, refinamento 3) — mesmos campos, `id` novo. */
export function duplicateFinding(finding: RondaFinding): RondaFinding {
  return { ...finding, id: newFindingId() };
}

export function emptyClosing(): RondaClosing {
  return { observacoesGerais: "", incluirGraficoResumo: false };
}

/** Bloco A: os 5 campos são todos obrigatórios para avançar pro wizard — mesmo gate usado por RondaWizard, extraído aqui pra ser testável sem DOM. */
export function metadataComplete(metadata: RondaMetadata): boolean {
  return Boolean(metadata.titulo.trim() && metadata.data.trim() && metadata.local.trim() && metadata.responsavel.trim() && metadata.turno.trim());
}

/** Achados ainda "não avaliado" — usado tanto para desenhar a lista de pendências quanto para travar o botão "Concluir ronda" (ADR-021: "não avaliado bloqueia conclusão"). Raro na lista dinâmica (achados só nascem já `identificado`), mas mantido como defesa — mesma regra que o backend replica (`validateRondaSubmission`). */
export function pendingFindings(findings: RondaFinding[]): RondaFinding[] {
  return findings.filter((finding) => finding.estado === "nao_avaliado");
}
