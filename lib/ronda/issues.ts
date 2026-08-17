/**
 * Traduz o array `issues` de um 422 de validação (`GENESIS_2026-08-17_URGENTE_
 * gate-ronda-divergente.md`) em algo que a tela de edição consegue apontar
 * campo a campo. Função pura, sem DOM nem IndexedDB — só string in, dado out.
 */
import { MISSING_FIELD_LABELS, type MissingField, type ValidationIssue } from "./types";

export interface ParsedIssue {
  findingId: string;
  field: MissingField;
}

const KNOWN_FIELDS = Object.keys(MISSING_FIELD_LABELS) as MissingField[];

/**
 * `achados.{id}.{campo}` → `{ findingId, field }`. `(.+)` é guloso de
 * propósito: um `id` de achado que contenha ponto (não deveria, mas
 * `crypto.randomUUID()` não é a única fonte de `id` neste código — ver
 * `newFindingId`) ainda deixa o sufixo `.{campo}` ser o que decide onde o
 * `id` termina, porque o regex backtracka até achar um dos quatro nomes de
 * campo conhecidos colado ao fim da string.
 *
 * Tolerante por design: formato de caminho é contrato do servidor, pode
 * mudar. Qualquer coisa que não case — caminho de metadado
 * (`metadata.titulo`), `achados` sem sufixo, campo fora do enum conhecido
 * (`achados.{id}.id`, do formato pré-migração) — devolve `null` em vez de
 * lançar; quem chama decide o que fazer (hoje: cai numa lista de "issues
 * sem achado" no topo da tela, com o texto do servidor).
 */
const ISSUE_PATH_PATTERN = new RegExp(`^achados\\.(.+)\\.(${KNOWN_FIELDS.join("|")})$`);

export function parseIssuePath(path: string): ParsedIssue | null {
  const match = ISSUE_PATH_PATTERN.exec(path);
  if (!match) return null;
  const [, findingId, field] = match;
  return { findingId, field: field as MissingField };
}

export type QueueRejectionKind = "recoverable" | "unrecoverable";

/**
 * Etapa 3 do pacote — desfaz a contradição "refaça e descarte" vs. "corrija
 * e salve". `unrecoverable` é o caso original do fix de 15/08 (payload
 * pré-migração, sem `id` de achado, ou sem `issues` nenhuma — formato velho
 * que não tem mapeamento seguro). `recoverable` é quando toda issue aponta
 * pra um dos quatro campos obrigatórios — corrigível na própria tela, sem
 * perder o registro nem as fotos.
 *
 * Uma mistura (uma issue mapeável + uma que não é) fica `unrecoverable` de
 * propósito: mais seguro subestimar o que dá pra corrigir do que prometer
 * "só falta preencher" quando existe um problema que a tela não sabe
 * mostrar.
 */
export function classifyQueueRejection(issues: ValidationIssue[] | undefined): QueueRejectionKind {
  if (!issues || issues.length === 0) return "unrecoverable";
  return issues.every((issue) => parseIssuePath(issue.path) !== null) ? "recoverable" : "unrecoverable";
}
