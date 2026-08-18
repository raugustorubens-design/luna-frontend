/**
 * `issues` que voltam de `luna-core` (`RondaValidationError`/422) —
 * `{path, message}[]`, mesmo shape de `ValidationIssue` em
 * `luna-core/src/convergia/contracts.ts`. `requiredWhenIdentified` endereça
 * pelo id do achado, não pelo índice: `achados.{id}.{campo}` — é isso que
 * permite acender o campo certo no card certo em vez de só mostrar a
 * contagem que o 422 original trazia.
 */
import type { RondaFinding } from "./types";
import { findingsWithMissingFields } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
}

const ACHADO_PREFIX = "achados.";

/**
 * Separa pelo *último* ponto, não o primeiro: `id` de achado é gerado por
 * `crypto.randomUUID()` hoje, mas nada garante que um id futuro (ou um id de
 * payload pré-migração) nunca contenha ponto — usar o último ponto como
 * separador do campo é o que sobrevive a esse caso sem precisar de um
 * formato de id mais estrito.
 */
export function parseIssuePath(path: string): { findingId: string; field: string } | null {
  if (!path.startsWith(ACHADO_PREFIX)) return null;
  const rest = path.slice(ACHADO_PREFIX.length);
  const lastDot = rest.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === rest.length - 1) return null;
  return { findingId: rest.slice(0, lastDot), field: rest.slice(lastDot + 1) };
}

export interface MappedIssues {
  /** Issue por achado, campo → mensagem real do servidor. */
  byFinding: Record<string, Record<string, string>>;
  /** Issues que não endereçam um achado da ronda carregada (metadado, duplicidade de id, achado que não existe mais localmente). */
  unmapped: ValidationIssue[];
}

export function mapIssuesToFindings(issues: ValidationIssue[], findingIds: Set<string>): MappedIssues {
  const byFinding: Record<string, Record<string, string>> = {};
  const unmapped: ValidationIssue[] = [];
  for (const issue of issues) {
    const parsed = parseIssuePath(issue.path);
    if (!parsed || !findingIds.has(parsed.findingId)) {
      unmapped.push(issue);
      continue;
    }
    byFinding[parsed.findingId] = { ...byFinding[parsed.findingId], [parsed.field]: issue.message };
  }
  return { byFinding, unmapped };
}

/**
 * Sinal de payload pré-migração (formato "categoria", sem `id` de achado
 * válido) — issue em `achados.N.id` (`"Required"`, id vazio), ou nenhuma
 * issue guardada (item caiu em "invalid" antes desta correção existir, ver
 * `lib/ronda/db.ts`). Esse segundo caso é só o pior cenário assumido quando
 * não há mais nada pra checar — o chamador (`RondaEditor`) prioriza o gate
 * do cliente (`findingsWithMissingFields`) sobre o conteúdo já carregado
 * antes de cair aqui, porque esse gate resolve o caso "campos faltando" sem
 * depender de `issues` ter sido persistida.
 */
export function isOldFormatRejection(issues: ValidationIssue[] | undefined): boolean {
  if (!issues || issues.length === 0) return true;
  return issues.some((issue) => parseIssuePath(issue.path)?.field === "id");
}

/**
 * Se é seguro oferecer "Descartar" pra um item "invalid" — deliberadamente
 * mais conservador do que `isOldFormatRejection`, que decide só a
 * *mensagem*. `isOldFormatRejection` usa `.some()`: basta uma issue em
 * `.id` pra classificar o payload inteiro como "formato antigo", mesmo que
 * outra issue do mesmo 422 aponte pra um campo de um achado que ainda está
 * na lista carregada — um payload misto assim ainda tem o que corrigir
 * editando o achado, só não é 100% do que o servidor reclamou. Manter a
 * mensagem "formato antigo" nesse caso está certo (a explicação técnica
 * exata não é o ponto); oferecer "Descartar" não — é oferecer perda de dado
 * (fotos que só existem neste aparelho) por cima de algo que dava pra
 * salvar.
 *
 * `true` só quando não há **nada** corrigível nesta tela: nem o gate do
 * cliente sobre o conteúdo já carregado (`findingsWithMissingFields`), nem
 * uma issue do servidor que mapeia pra um campo de um achado que ainda
 * existe na lista (`mapIssuesToFindings(...).byFinding`).
 */
export function canDiscardInvalidItem(achados: RondaFinding[], issues: ValidationIssue[] | undefined): boolean {
  if (findingsWithMissingFields(achados).length > 0) return false;
  const findingIds = new Set(achados.map((finding) => finding.id));
  const { byFinding } = mapIssuesToFindings(issues ?? [], findingIds);
  return Object.keys(byFinding).length === 0;
}
