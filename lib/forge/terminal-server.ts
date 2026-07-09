import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { WebSocket, WebSocketServer } from "ws";

/**
 * Gate do terminal (revisão de código, achado P1): sem isso, qualquer
 * conexão que alcançasse `/forge/terminal` no serviço público ganhava um
 * shell interativo sem nenhuma checagem — execução de comando arbitrário
 * para qualquer um que soubesse a URL. Em desenvolvimento local (`isDev`,
 * ambiente confiável — só o operador tem acesso à porta), segue liberado.
 * Em produção, só aceita a conexão com um token que bate com
 * `expectedToken` (`FORGE_TERMINAL_TOKEN`) — sem essa variável configurada,
 * o terminal fica desabilitado por padrão (nenhum shell é criado).
 *
 * Não é autenticação real (o token, quando configurado, também é exposto ao
 * client via `NEXT_PUBLIC_FORGE_TERMINAL_TOKEN` — ver DEPLOY.md) — é o
 * controle mínimo apropriado para este MVP: impede bots/scanners
 * automatizados, exige leitura deliberada do bundle do client para extrair
 * o segredo. Autenticação real do Forge é dívida registrada, não
 * implementada aqui.
 */
export function verifyTerminalClient(
  isDev: boolean,
  expectedToken: string | undefined,
  requestUrl: string | undefined,
): { allowed: true } | { allowed: false; code: number; message: string } {
  if (isDev) return { allowed: true };

  if (!expectedToken) {
    return { allowed: false, code: 503, message: "Forge terminal is disabled — FORGE_TERMINAL_TOKEN is not configured" };
  }

  const providedToken = new URL(requestUrl ?? "", "http://internal").searchParams.get("token");
  if (providedToken === expectedToken) return { allowed: true };

  return { allowed: false, code: 401, message: "Unauthorized" };
}

/** Adapta `verifyTerminalClient` para a assinatura `verifyClient` da `ws` (usada em server.ts). */
export function createTerminalClientVerifier(isDev: boolean) {
  return (
    info: { req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void,
  ): void => {
    const result = verifyTerminalClient(isDev, process.env.FORGE_TERMINAL_TOKEN, info.req.url);
    if (result.allowed) {
      callback(true);
    } else {
      callback(false, result.code, result.message);
    }
  };
}

/**
 * Plain command execution over a spawned shell — no automation, no agent
 * loop, exactly what MVP-01 asks for ("Sem automações. Sem agentes. Apenas
 * execução de comandos"). This intentionally does NOT use a real PTY
 * (node-pty): that needs native compilation, which is a real installability
 * risk this MVP doesn't need to take on for "run a command and see the
 * output". Known limitation, registered here rather than hidden: full-screen
 * interactive programs (vim, htop, an actual `ssh` session) will not render
 * correctly without a PTY.
 *
 * Portado de forge/apps/server/src/terminal.ts (monorepo `luna`), sem
 * alterações de lógica — só deixou de rodar num servidor Express dedicado e
 * passou a anexar no mesmo http.Server do custom server do Next.js.
 */
export function attachTerminal(wss: WebSocketServer, workingDirectory: string): void {
  wss.on("connection", (socket: WebSocket) => {
    const shell = process.env.SHELL ?? "/bin/bash";
    const child: ChildProcessWithoutNullStreams = spawn(shell, ["-i"], {
      cwd: workingDirectory,
      env: process.env,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (socket.readyState === socket.OPEN) socket.send(chunk.toString("utf8"));
    });
    child.on("exit", (code) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(`\r\n[processo encerrado, código ${code}]\r\n`);
        socket.close();
      }
    });

    socket.on("message", (data) => {
      child.stdin.write(data.toString());
    });

    socket.on("close", () => {
      child.kill();
    });
  });
}
