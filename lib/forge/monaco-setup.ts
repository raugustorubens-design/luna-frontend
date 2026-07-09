"use client";

/**
 * Configura o @monaco-editor/react para usar o `monaco-editor` vendorizado em
 * public/monaco-editor/vs (copiado de node_modules em build/install — ver
 * scripts/copy-monaco-assets.mjs), em vez do loader padrão que busca em um
 * CDN externo (jsdelivr).
 *
 * `getWorkerUrl` é necessário além de `paths.vs`: os workers do Monaco
 * (json/css/html/ts) são carregados de dentro de outro worker
 * (`workerMain.js`), cujo próprio contexto é uma blob: URL — caminhos
 * relativos como "/monaco-editor/vs/..." não resolvem contra a origem da
 * página nesse contexto ("Failed to parse URL from ..."). O bootstrap padrão
 * do Monaco para self-host sem webpack é retornar uma data: URL que primeiro
 * fixa `self.MonacoEnvironment.baseUrl` como URL absoluta e só então importa
 * o workerMain.js real, também com URL absoluta.
 */
import { loader } from "@monaco-editor/react";

let configured = false;

export function ensureMonacoConfigured() {
  if (configured) return;
  configured = true;

  const origin = window.location.origin;

  (self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
    getWorkerUrl: (_moduleId: string, _label: string) =>
      `data:text/javascript;charset=utf-8,${encodeURIComponent(
        `self.MonacoEnvironment = { baseUrl: '${origin}/monaco-editor/' };\nimportScripts('${origin}/monaco-editor/vs/base/worker/workerMain.js');`,
      )}`,
  };

  loader.config({ paths: { vs: "/monaco-editor/vs" } });
}
