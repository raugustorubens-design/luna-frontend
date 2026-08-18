// ADR-022 — tema claro/escuro das superfícies fora de /ronda (`/v2` e
// `/forge?layout=v2`). Alternância manual por botão, sem automático por
// `prefers-color-scheme`, pela mesma decisão do Architect já registrada em
// `lib/ronda/theme.ts`. Escuro é o padrão do produto.
export type SiteTheme = "dark" | "light";

/**
 * Chave PRÓPRIA, separada de `luna-ronda-theme`.
 *
 * Dívida aceita e registrada no ADR-022: são duas preferências de tema
 * coexistindo, uma para `/ronda` e outra para o resto do produto. Unificar
 * exigiria editar o provider da ronda — que está escopado de propósito para
 * não alcançar o Forge, e é esse escopo que impede um efeito colateral em
 * campo. A unificação é etapa futura, com migração de leitura das duas
 * chaves.
 */
export const SITE_THEME_STORAGE_KEY = "luna-site-theme";

/** Atributo lido pelos blocos `[data-theme="light"]` de `app/globals.css`. */
export const SITE_THEME_ATTRIBUTE = "data-theme";
