// Copia monaco-editor/min/vs (o loader AMD clássico + workers) para public/,
// para que o Editor do Forge (Dev Mode) carregue o Monaco same-origin em vez
// de depender de um CDN externo. Mesma decisão que já valeu no MVP-01
// standalone (ver forge/apps/web/src/lib/monaco-setup.ts no monorepo `luna`),
// só que aqui via loader AMD clássico (mais simples sob o build do Next.js)
// em vez de workers `?worker` do Vite.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "node_modules", "monaco-editor", "min", "vs");
const destination = join(root, "public", "monaco-editor", "vs");

if (!existsSync(source)) {
  console.error(`[copy-monaco-assets] monaco-editor não encontrado em ${source}. Rode "pnpm install" primeiro.`);
  process.exit(1);
}

mkdirSync(dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });
console.log(`[copy-monaco-assets] copiado para ${destination}`);
