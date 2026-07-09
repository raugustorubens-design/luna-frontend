// Constituição executável do Forge (Dev Mode), portada de
// forge/scripts/constitution-check.mjs (monorepo `luna`) para o layout do
// luna-frontend. Verifica que nenhum código de app/, components/, lib/ ou
// server.ts acessa banco/provider diretamente ou importa um órgão interno —
// só contratos HTTP públicos (Gateway, /api/chat) são permitidos.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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

const DATABASE_TOKENS = /supabase|drizzle|@supabase\/supabase-js|['"]pg['"]/i;
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

  assert.doesNotMatch(
    source,
    DATABASE_TOKENS,
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

console.log(`Constitution checks passed (${sourceFiles.length} files scanned).`);
