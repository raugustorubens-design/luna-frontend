/**
 * Traduz `ValidationIssue.path` (formato do servidor, `luna-core/src/convergia/ronda/validation.ts`
 * — `requiredWhenIdentified` endereça por `achados.{id}.{campo}`) em algo que
 * o `FindingCard` certo consegue destacar. Função pura, sem conhecimento de
 * `RondaFinding[]` — quem chama decide o que fazer com um `findingId` que
 * não bate com nenhum achado carregado (ex. formato pré-migração, id que já
 * não existe mais na lista).
 *
 * Tolerante de propósito: o formato de `path` é contrato do servidor, pode
 * mudar sem aviso — um caminho que não casa vira `null`, nunca uma exceção.
 */
import { MISSING_FIELDS, type MissingField, type ValidationIssue } from "./types";

export interface ParsedIssuePath {
  findingId: string;
  field: string;
}

/**
 * `achados.{id}.{campo}` → `{ findingId, field }`. O `id` do achado pode
 * conter pontos (não é garantido pelo cliente que gera `crypto.randomUUID()`
 * hoje, mas o formato de `path` não faz essa promessa) — por isso o campo é
 * sempre o último segmento, e o `id` é tudo entre `achados.` e o campo,
 * pontos e tudo. Caminhos com menos de 3 segmentos (`achados.{id}`, sem
 * campo — o caso de id duplicado) ou que não começam em `achados` (ex.
 * `metadata.titulo`) devolvem `null`.
 */
export function parseIssuePath(issue: ValidationIssue): ParsedIssuePath | null {
  const parts = issue.path.split(".");
  if (parts.length < 3 || parts[0] !== "achados") return null;
  const field = parts[parts.length - 1];
  const findingId = parts.slice(1, -1).join(".");
  if (!findingId || !field) return null;
  return { findingId, field };
}

function isMissingField(field: string): field is MissingField {
  return (MISSING_FIELDS as readonly string[]).includes(field);
}

/**
 * Distingue as duas situações da Etapa 3: uma rejeição só é "recuperável"
 * (corrigível na própria tela) quando **toda** issue aponta pra um dos 4
 * campos obrigatórios (`departamento`/`classificacao`/`gravidade`/`descricao`)
 * de um achado. Qualquer issue fora desse formato — `achados.{n}.id`
 * "Required" (payload pré-migração, sem `id` de achado), `achados.{id}`
 * (id duplicado) ou nenhuma issue registrada (item que ficou "invalid" antes
 * desta mudança) — marca a rejeição como não recuperável: não há campo pra
 * acender, refazer a ronda é o único caminho.
 */
export function isRecoverableRejection(issues: ValidationIssue[] | undefined | null): boolean {
  if (!issues || issues.length === 0) return false;
  return issues.every((issue) => {
    const parsed = parseIssuePath(issue);
    return parsed !== null && isMissingField(parsed.field);
  });
}

/**
 * Separa as issues em duas partes: as que casam com um achado da lista
 * carregada (por `findingId` e por serem um dos 4 campos conhecidos) viram
 * mensagem real do servidor por campo; o resto — id que não existe mais na
 * lista, campo desconhecido, caminho que não parseia — sobra pra exibição
 * genérica no topo da tela (nunca descartado, sempre com o texto do
 * servidor).
 */
export function groupIssuesByFinding(
  issues: ValidationIssue[],
  findingIds: ReadonlySet<string>,
): { byFinding: Map<string, Partial<Record<MissingField, string>>>; unmapped: ValidationIssue[] } {
  const byFinding = new Map<string, Partial<Record<MissingField, string>>>();
  const unmapped: ValidationIssue[] = [];

  for (const issue of issues) {
    const parsed = parseIssuePath(issue);
    if (!parsed || !isMissingField(parsed.field) || !findingIds.has(parsed.findingId)) {
      unmapped.push(issue);
      continue;
    }
    const bucket = byFinding.get(parsed.findingId) ?? {};
    bucket[parsed.field] = issue.message;
    byFinding.set(parsed.findingId, bucket);
  }

  return { byFinding, unmapped };
}
