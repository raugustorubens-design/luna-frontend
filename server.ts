/**
 * Custom server: Next.js request handler + WebSocketServer no mesmo
 * http.Server, para que o terminal do Forge (Dev Mode) funcione dentro de um
 * único serviço/processo — requisito desta etapa de consolidação (um serviço
 * Railway, não dois). Substitui `next start`/`next dev` puros.
 *
 * O terminal e o git-status locais são as duas únicas peças do Forge que não
 * passam pelo Gateway (ver decisão registrada em LUNA_CONTEXT.md): execução
 * de comando local e leitura de branch/commit do checkout local não são
 * capacidades do organismo LUNA, são ferramentas do próprio ambiente onde
 * este serviço roda.
 */
import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { attachTerminal, createTerminalClientVerifier } from "./lib/forge/terminal-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const workingDirectory = process.env.FORGE_WORKING_DIRECTORY ?? process.cwd();

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  // Gate do terminal (achado de revisão de código, P1) — ver
  // lib/forge/terminal-server.ts para o motivo e o comportamento completo.
  const wss = new WebSocketServer({ server, path: "/forge/terminal", verifyClient: createTerminalClientVerifier(dev) });
  attachTerminal(wss, workingDirectory);

  server.listen(port, () => {
    console.log(`LUNA Frontend (User Mode + Forge Dev Mode) listening on port ${port}`);
    console.log(`Forge working directory: ${workingDirectory}`);
  });
});
