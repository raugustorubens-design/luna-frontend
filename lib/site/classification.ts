/**
 * ADR-022 — a gramática de classificação da ronda como identidade visual.
 *
 * São os mesmos três estados de `FindingClassification` em
 * `lib/ronda/types.ts`, com os mesmos hex de `CLASSIFICATION_FILL_CLASS` em
 * `components/ronda/finding-card.tsx`. Não é uma escala de status genérica
 * herdada de um design system: é a linguagem com que a LUNA classifica um
 * achado numa planta industrial, aplicada a ela própria.
 *
 * Preenchimento sólido nos dois temas, sem variante clara. Um "não
 * conformidade" tem a mesma cor no celular em campo, no relatório impresso e
 * aqui — é essa igualdade que dá sentido a padronizar a paleta.
 */
export type SiteClassification = "ok" | "warn" | "fail";

export const SITE_CLASSIFICATION_LABELS: Record<SiteClassification, string> = {
  ok: "Conforme",
  warn: "Atenção",
  fail: "Não conforme",
};

/**
 * O que cada estado quer dizer, palavra por palavra. Vai ao pé do razão como
 * legenda porque a classificação só é honesta se o critério estiver à vista.
 */
export const SITE_CLASSIFICATION_CRITERIA: Record<SiteClassification, string> = {
  ok: "Conforme — funciona e foi visto funcionando",
  warn: "Atenção — funciona com limitação conhecida",
  fail: "Não conforme — não atende ao que deveria",
};

/**
 * Classes estáticas (não template dinâmico), pelo mesmo motivo registrado em
 * `finding-card.tsx`: o JIT do Tailwind precisa conseguir escanear a classe
 * no build.
 */
export const SITE_CLASSIFICATION_FILL: Record<SiteClassification, string> = {
  ok: "bg-luna-ok text-luna-onOk",
  warn: "bg-luna-warn text-luna-onWarn",
  fail: "bg-luna-fail text-luna-onFail",
};

export const SITE_CLASSIFICATION_BAR: Record<SiteClassification, string> = {
  ok: "bg-luna-ok",
  warn: "bg-luna-warn",
  fail: "bg-luna-fail",
};
