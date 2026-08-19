/**
 * Pacote "gate com link ao campo"
 * (`GENESIS/pacotes/2026-08-19-gate-com-link-ao-campo.md`, `Luna-context.md`).
 *
 * Um único gerador de id de DOM, usado pelos dois lados: `FindingCard` (o
 * `id` do wrapper de cada campo obrigatório) e o aviso de campo faltando (o
 * alvo do link). Nunca escrito à mão em nenhum dos dois — é a lição do bug
 * da foto aplicada antes: lá, `fotos[]`/`fotoIds[]` divergiram porque um
 * consumidor continuou lendo o formato antigo, e o resultado foi
 * indistinguível de "não tem foto". Aqui, se o card e o aviso montarem o id
 * separadamente, o link quebra e falha exatamente igual a um campo já
 * preenchido — clica e não acontece nada.
 */
import type { MissingField } from "./types";

export function fieldDomId(findingId: string, field: MissingField): string {
  return `campo-${findingId}-${field}`;
}

/**
 * Rola até o campo e foca, na ordem que a captura de campo real exige:
 * primeiro o foco (com `preventScroll`, pra não deixar o navegador decidir
 * a rolagem sozinho), depois a rolagem explícita — e uma segunda rolagem
 * um instante depois, porque no celular o teclado abre *depois* do foco e
 * encolhe a viewport, empurrando o alvo pra fora de novo.
 *
 * O alvo é o wrapper do campo (onde o `id` de `fieldDomId` vive, o mesmo
 * elemento que já ganha a marcação âmbar quando o campo está pendente) — a
 * função busca dentro dele o controle de fato focável (`input`/`select`/
 * `textarea`, ou o primeiro rádio de um `radiogroup`, caso de
 * "classificação").
 *
 * `block: "center"` em vez de depender de `scroll-margin-top`: este
 * layout não tem cabeçalho sobreposto ao conteúdo rolável (o cabeçalho do
 * wizard e do editor ficam fora de `<main>`, num container próprio — ver
 * `ronda-wizard.tsx`/`ronda-editor.tsx`), então não há o que compensar;
 * centralizar é robusto de qualquer forma, inclusive se isso mudar depois.
 */
export function scrollToField(findingId: string, field: MissingField): void {
  if (typeof document === "undefined") return;
  const container = document.getElementById(fieldDomId(findingId, field));
  if (!container) return;

  const focusTarget =
    (container.matches("input, select, textarea") ? container : container.querySelector<HTMLElement>("input, select, textarea, [role='radio']")) ??
    container;

  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  focusTarget.focus({ preventScroll: true });
  container.scrollIntoView({ behavior, block: "center" });
  window.setTimeout(() => container.scrollIntoView({ behavior: "auto", block: "center" }), 350);
}
