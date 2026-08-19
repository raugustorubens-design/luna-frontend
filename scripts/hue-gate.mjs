/**
 * Portão de matiz do Padrão SMX de Cores (`Luna-context.md`,
 * `GENESIS/padroes/PADRAO-SMX-CORES.md` §4, adotado por `ADR-024`).
 *
 * Extraído para ser testável isoladamente, mesmo padrão de
 * `constitution-rules.mjs`. Toda cor hexadecimal literal em
 * `components/site/**` e nos arquivos `*-v2` do Forge precisa cair entre
 * 200°–220° (azul — a faixa medida na logo SMX e nas três imagens de
 * referência) ou 17°–55° (dourado — a faixa de emissão quente). Fora dessas
 * duas faixas, não entra.
 *
 * Foi a ausência desta regra que deixou um roxo (`#A78BFA`) entrar na
 * coloração de sintaxe do Forge vindo de um tema de editor emprestado, sem
 * nada para reprovar.
 */

const HEX_LITERAL_PATTERN = /#[0-9a-fA-F]{6}\b/g;

/**
 * Exceções declaradas pelo pacote que instituiu o portão: as cores sólidas
 * de classificação e de marca (vêm de campo/relatório impresso, não do
 * portão), mais toda a rampa nova (void, str1-4, glow1-5, spec, warm3-5)
 * acrescentada ao mesmo tempo em `tailwind.config.ts` — a rampa foi
 * calculada pelo mesmo
 * método que definiu o portão, então testá-la contra ele seria circular.
 */
export const HUE_GATE_EXCEPTIONS = new Set(
  [
    // Classificação e marca — exceção permanente (padrão de cores, §1/§7).
    "#2E7D32",
    "#E8A33D",
    "#C62828",
    "#1E2761",
    "#FFFFFF",
    // Rampa nova — ambiente, material, emissão fria, emissão quente (parcial).
    "#000206",
    "#001428",
    "#001E3C",
    "#0A283C",
    "#143A5A",
    "#3068A0",
    "#5A7896",
    "#7088A0",
    "#8098B0",
    "#A0B8C8",
    "#F8F8F8",
    "#C09030",
    "#E4B448",
    "#F8E8A0",
  ].map((hex) => hex.toUpperCase()),
);

/** Matiz (0–360) de um hex `#RRGGBB`, pela conversão padrão RGB→HSL. */
export function hexHue(hex) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // Sem saturação (cinza puro, incluindo preto e branco): matiz indefinido.
  // Retorna 0 — que reprova as duas faixas do portão, então um cinza/preto/
  // branco fora da lista de exceções ainda é pego, em vez de escapar por um
  // valor sentinela que por acaso caísse dentro de uma faixa válida.
  if (delta === 0) return 0;

  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/** `true` se o hex passa no portão — exceção declarada, ou matiz em [200,220] ou [17,55]. */
export function passesHueGate(hex) {
  const normalized = hex.toUpperCase();
  if (HUE_GATE_EXCEPTIONS.has(normalized)) return true;
  const hue = hexHue(normalized);
  return (hue >= 200 && hue <= 220) || (hue >= 17 && hue <= 55);
}

/** Toda cor hex literal no código-fonte que reprova o portão de matiz. */
export function findHueGateViolations(source) {
  const violations = [];
  for (const match of source.matchAll(HEX_LITERAL_PATTERN)) {
    const hex = match[0];
    if (!passesHueGate(hex)) violations.push(hex);
  }
  return violations;
}
