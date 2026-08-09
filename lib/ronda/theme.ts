// Tema claro/escuro do wizard de ronda (/ronda) — decisão do Architect:
// alternância manual (botão), não automática por prefers-color-scheme.
// Escuro é o padrão do produto; a preferência escolhida persiste entre
// visitas.
export type RondaTheme = "dark" | "light";

export const RONDA_THEME_STORAGE_KEY = "luna-ronda-theme";
