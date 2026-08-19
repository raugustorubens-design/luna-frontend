// Constituição executável do Forge (Dev Mode), portada de
// forge/scripts/constitution-check.mjs (monorepo `luna`) para o layout do
// luna-frontend. Verifica que nenhum código de app/, components/, lib/ ou
// server.ts acessa banco/provider diretamente ou importa um órgão interno —
// só contratos HTTP públicos (Gateway, /api/chat) são permitidos.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { containsDatabaseModuleImport } from "./constitution-rules.mjs";
import { findHueGateViolations } from "./hue-gate.mjs";

const root = new URL("..", import.meta.url).pathname;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "dist", "out"]);

function listFiles(relativeDir, extensions) {
  const absoluteDir = join(root, relativeDir);
  let entries;
  try {
    entries = readdirSync(absoluteDir);
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const entryRelativePath = join(relativeDir, entry);
    const absoluteEntryPath = join(root, entryRelativePath);
    if (statSync(absoluteEntryPath).isDirectory()) {
      files.push(...listFiles(entryRelativePath, extensions));
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(entryRelativePath);
    }
  }
  return files;
}

const sourceFiles = [
  ...listFiles("app", [".ts", ".tsx"]),
  ...listFiles("components", [".ts", ".tsx"]),
  ...listFiles("lib", [".ts", ".tsx"]),
  "server.ts",
];

assert.ok(sourceFiles.length > 0, "luna-frontend source files must exist for this check to mean anything");

// Revisão do Engenheiro, luna-frontend#28 apontamento 1 (17/08/2026) — a
// regra de "nenhum acesso a banco direto" mora em `constitution-rules.mjs`,
// pra poder ser testada isoladamente (`scripts/__tests__/constitution-rules.test.ts`).
// Ver o comentário lá para o histórico completo: casava a palavra solta em
// qualquer lugar do arquivo → estreitada pra especificador de import exato
// → generalizada pra família de módulo (pega `@supabase/ssr`,
// `drizzle-orm/pg-core`, `import "pg"` sem `from`, que o nome exato deixava
// passar).
const PROVIDER_TOKENS =
  /GroqAdapter|ChatGptAdapter|ClaudeAdapter|GrokAdapter|ManusAdapter|api\.groq\.com|api\.openai\.com|api\.anthropic\.com/;
const INTERNAL_ORGAN_IMPORT = /from\s+["']\.{2,}\/(.*\/)?apps\/frontend\/artifacts\/api-server\/src\//;

for (const relativePath of sourceFiles) {
  const absolutePath = join(root, relativePath);
  let source;
  try {
    source = readFileSync(absolutePath, "utf8");
  } catch {
    continue;
  }

  assert.ok(
    !containsDatabaseModuleImport(source),
    `Forge must never access a database directly (found in ${relativePath})`,
  );
  assert.doesNotMatch(
    source,
    PROVIDER_TOKENS,
    `Forge must never call an AI provider directly — route through /api/chat (found in ${relativePath})`,
  );
  assert.doesNotMatch(
    source,
    INTERNAL_ORGAN_IMPORT,
    `Forge must stay decoupled from internal organs — only HTTP contracts are allowed (found in ${relativePath})`,
  );
}

// ---- Context Panel (Forge MVP-02): context must be reconstructed by the ----
// ---- Context Hub, never read from markdown/files directly ----
const contextPanelPath = "components/forge/context-panel.tsx";
const contextPanelSource = readFileSync(join(root, contextPanelPath), "utf8");
assert.match(
  contextPanelSource,
  /fetchOrganismContext/,
  `Context Panel must consume the Context Hub via fetchOrganismContext() (found in ${contextPanelPath})`,
);
assert.doesNotMatch(
  contextPanelSource,
  /readFile\(|LUNA_CONTEXT\.md/,
  `Context Panel must never read markdown/files directly — that dependency was eliminated in Forge MVP-02 (found in ${contextPanelPath})`,
);

// ---- Terminal WebSocket (security review finding, P1): must stay gated ----
const serverSource = readFileSync(join(root, "server.ts"), "utf8");
assert.match(
  serverSource,
  /verifyClient/,
  "server.ts must gate the terminal WebSocket upgrade (verifyClient) — regression guard for the unauthenticated-shell finding",
);
const terminalServerPath = "lib/forge/terminal-server.ts";
const terminalServerSource = readFileSync(join(root, terminalServerPath), "utf8");
assert.match(
  terminalServerSource,
  /FORGE_TERMINAL_TOKEN|verifyTerminalClient/,
  `${terminalServerPath} must keep the terminal token check — regression guard for the unauthenticated-shell finding`,
);

// ---- Modo Usuário v2 must not reach for the legacy v1 palette (ADR-022, ----
// ---- revisão do Engenheiro luna-frontend#28 apontamento 2, 17/08/2026) ----
// `luna.success`/`luna.danger` (tailwind.config.ts) são tokens do Modo
// Usuário v1, não a paleta de classificação (`luna.ok`/`luna.warn`/
// `luna.fail`) — as duas convivem com nomes igualmente plausíveis, e é
// exatamente o tipo de fronteira que este script existe pra guardar: sem
// isto, um "não conformidade" pode sair com uma cor diferente da do
// celular/relatório só porque alguém escreveu `text-luna-danger` achando
// que era o vermelho certo.
const LEGACY_CLASSIFICATION_TOKEN = /\bluna-(?:success|danger)\b/;
const siteFiles = listFiles("components/site", [".ts", ".tsx"]);
for (const relativePath of siteFiles) {
  const source = readFileSync(join(root, relativePath), "utf8");
  assert.doesNotMatch(
    source,
    LEGACY_CLASSIFICATION_TOKEN,
    `components/site/** must use luna-ok/luna-warn/luna-fail for classification, not the legacy v1 tokens luna-success/luna-danger (found in ${relativePath})`,
  );
}

// ---- Portão de matiz (Padrão SMX de Cores, ADR-024 — pacote "tirar o ----
// ---- roxo do site", GENESIS/pacotes/2026-08-19-tirar-o-roxo.md, Etapa 4) --
// Nenhuma regra impedia um roxo de entrar em `components/site/**` ou nos
// arquivos `*-v2` do Forge — foi assim que #A78BFA (275° na medição
// original, ~255° pelo cálculo desta regra) entrou na coloração de sintaxe
// do Forge, vindo de um tema de editor emprestado. Regra e exceções em
// `hue-gate.mjs`, testadas isoladamente em `scripts/__tests__/hue-gate.test.ts`
// (um caso positivo e um negativo, incluindo o próprio #A78BFA).
const forgeV2Files = listFiles("components/forge", [".ts", ".tsx"]).filter((path) => path.includes("-v2"));
const hueGateFiles = [...siteFiles, ...forgeV2Files];
for (const relativePath of hueGateFiles) {
  const source = readFileSync(join(root, relativePath), "utf8");
  const violations = findHueGateViolations(source);
  assert.deepEqual(
    violations,
    [],
    `color(es) fora do portão de matiz (200°-220° ou 17°-55°) em ${relativePath}: ${violations.join(", ")}`,
  );
}

console.log(
  `Constitution checks passed (${sourceFiles.length} files scanned, ${siteFiles.length} components/site files checked for legacy classification tokens, ${hueGateFiles.length} files checked against the hue gate).`,
);
