/**
 * Regra de "nenhum acesso a banco direto", extraída de `constitution-check.mjs`
 * pra poder ser testada isoladamente (revisão do Engenheiro em
 * `luna-frontend#28`, apontamento 1, 17/08/2026).
 *
 * Histórico da regra: começou como `/supabase|drizzle|.../i` — casava a
 * palavra solta em qualquer lugar do arquivo, inclusive em prosa real (o
 * razão de estado de `/v2` descreve, em texto verificável, que a Memória
 * "grava no Supabase"). Ancorada em especificador de import/require na
 * primeira correção (ADR-022) — mas por nome exato, o que deixava passar
 * `@supabase/ssr` (o pacote Supabase mais usado em Next hoje),
 * `drizzle-orm/pg-core` (o import normal do Drizzle) e `import "pg"` sem
 * `from` (efeito colateral). Esta versão casa por família — qualquer
 * pacote sob `@supabase/*`, `drizzle-orm` e qualquer subcaminho dele, e os
 * três clientes de Postgres mais comuns — e cobre as cinco formas de
 * referenciar um módulo em JS/TS: `import … from "x"`, `export … from "x"`,
 * `import "x"` (efeito colateral), `require("x")`, `import("x")` (dinâmico).
 */

/**
 * Família de módulo proibida, por PREFIXO/família, não nome exato — é isso
 * que resolve `@supabase/ssr` e `drizzle-orm/pg-core` sem precisar listar
 * cada subcaminho publicado.
 */
export const DATABASE_MODULE_FAMILY = /^(?:@supabase\/.+|drizzle-orm(?:\/.+)?|pg|postgres|pg-promise)$/;

/**
 * Encontra o especificador de módulo (o texto entre aspas) em qualquer uma
 * das cinco formas de import/require — não em qualquer string do arquivo.
 * `\bimport\s+["']` só casa a forma de efeito colateral (`import "x"`);
 * `import Foo from "x"` é pego pela alternativa `from\s+["']`, porque ali
 * "import " não é seguido de aspas diretamente (é seguido do identificador
 * `Foo`), então a alternativa de efeito colateral não dispara — as duas
 * convivem sem sobreposição.
 */
const MODULE_SPECIFIER_PATTERN = /(?:\bfrom\s+|\brequire\(\s*|\bimport\(\s*|\bimport\s+)["']([^"']+)["']/g;

/** `true` se o código-fonte referencia, de qualquer uma das cinco formas, um módulo da família proibida. */
export function containsDatabaseModuleImport(source) {
  for (const match of source.matchAll(MODULE_SPECIFIER_PATTERN)) {
    if (DATABASE_MODULE_FAMILY.test(match[1])) return true;
  }
  return false;
}
